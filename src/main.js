import Cubes from '../src/misc/Cubes'
import Lights from '../src/misc/Lights'

import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'
import * as DesktopVision from '@desktop.vision/js-sdk/dist/three.min'

const {
	Computer,
	ComputerConnection,
} = DesktopVision.loadSDK(THREE, XRControllerModelFactory, XRHandModelFactory);

let code, token, computers = [], computerId;
let computerConnection, desktop, mouseControls, touchControls, keyboardControls, xrControls, keyboard;

const sceneContainer = document.getElementById("scene-container");
const computersContainer = document.getElementById('computers-wrapper')
const authCodeButton = document.getElementById("dv-auth-code")
const authTokenButton = document.getElementById("dv-auth-token")
const fetchComputersButton = document.getElementById("dv-fetch-computers")
const connectSingleComputerButton = document.getElementById("dv-connect-computer")
const enterSceneButton = document.getElementById("enter-scene-button")
const createComputerButton = document.getElementById("computer-test-button")
const computerRemoveButton = document.getElementById("computer-remove-button")

const clientID = "6wlqRxEgp60JXkcGkLY2"; //must match the api key used on the server

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
const camera = new THREE.PerspectiveCamera();
const cubes = new Cubes(scene)
const lights = new Lights(scene)

const renderAsLayer = false

loadScene()
checkUrlParams()
updateButtonState()
addButtonEventListeners()
addWindowResizeEventListener()


function loadScene() {
	renderer.xr.enabled = true;
	renderer.setAnimationLoop(render);
	sceneContainer.appendChild(renderer.domElement);
	camera.position.set(0, 1.6, 0);
	lights.addToScene()
	if (!renderAsLayer) cubes.addToScene()
}

function render(time) {

	if (cubes) cubes.animate(time)
	if (desktop) desktop.update()

	renderer.render(scene, camera);
}

function addWindowResizeEventListener() {
	const sceneBounds = sceneContainer.getBoundingClientRect();
	const { width, height } = sceneBounds
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	renderer.setSize(width - 4, height - 4);
	window.onresize = addWindowResizeEventListener
}

function addButtonEventListeners() {
	computerRemoveButton.onclick = removeComputer
	enterSceneButton.onclick = enterVR
	authCodeButton.onclick = getDvCode
	authTokenButton.onclick = connectToDV
	fetchComputersButton.onclick = fetchComputers
	createComputerButton.onclick = createTestComputer
	connectSingleComputerButton.onclick = connectToSingleComputer
}

function updateButtonState() {
	authCodeButton.disabled = code
	fetchComputersButton.disabled = !token
	authTokenButton.disabled = !code
	connectSingleComputerButton.disabled = !token || !computerId
}

async function enterVR() {
	try {
		const sessionOptions = { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "layers"] }
		const session = await navigator.xr.requestSession("immersive-vr", sessionOptions);
		renderer.xr.setReferenceSpaceType("local-floor");
		renderer.xr.setSession(session);
	} catch (e) {
		console.log(e)
	}
}

function getDvCode() {
	const scope = encodeURIComponent("connect,list");

	const redirectURL = new URL(window.location.href);
	redirectURL.searchParams.set("oauth", "desktopvision");
	const redirectUri = encodeURIComponent(redirectURL);
	const selectComputer = true
	const method = 'popup' // change this to something else for same window auth
	if (method === 'popup') {
		const newWindow = window.open(`https://desktop.vision/login/?response_type=code&client_id=${clientID}&scope=${scope}&redirect_uri=${redirectUri}&redirect_type=popup&selectComputer=true`);
		window.onmessage = function (e) {
			code = e.data.code
			computerId = e.data.computerId
			if (code && computerId) {
				newWindow.close()
				updateButtonState()
			}
		};
	} else {
		window.location.href = `https://desktop.vision/login/?response_type=code&client_id=${clientID}&scope=${scope}&redirect_uri=${redirectUri}&selectComputer=${selectComputer}`;
	}
}

async function connectToDV() {
	try {
		const response = await fetch(`/desktop-vision-auth?code=${code}`);
		const userData = await response.json();
		token = userData.token;
	} catch (e) {
		console.log(e.message)
	}
	clearUrlParams();
	updateButtonState()
}

async function connectToSingleComputer() {
	await fetchComputers()
	const selectedC = computers.find(c => c.id === computerId)
	connectToComputer(selectedC)
}

async function fetchComputers() {
	const apiEndPoint = `https://desktop.vision/api/users/${token.uid}/computers?access_token=${token.access_token}`;
	const res = await fetch(apiEndPoint);
	computers = await res.json();
	createComputerButtons(computers)
}

function createComputerButtons(computers) {
	const computersExist = computers.length > 0
	for (const child of computersContainer.children) computersContainer.removeChild(child)
	if (computersExist) {
		for (const computer of computers) {
			const computerButton = document.createElement('button')
			computerButton.onclick = () => connectToComputer(computer)
			computerButton.textContent = "Stream " + computer.computerName
			computersContainer.appendChild(computerButton)
		}
	} else {
		const missingTextDiv = document.createElement('div')
		missingTextDiv.textContent = "No computers available for this user. Try connecting to a different Desktop Vision account, or connect a streamer app."
		computersContainer.appendChild(missingTextDiv)
	}
}

function checkUrlParams() {
	const urlParams = new URLSearchParams(window.location.search);
	code = urlParams.get("code");
	computerId = urlParams.get("computer_id");
}

function clearUrlParams() {
	const url = new URL(location.href);
	url.searchParams.delete("oauth");
	url.searchParams.delete("code");
	url.searchParams.delete("computer_id");
	window.history.replaceState({}, "", url);
	code = null;
}

async function connectToComputer(computer) {
	const method = "POST"
	const body = JSON.stringify({ "channel_name": computer.channel_name })
	const headers = { "Content-Type": "application/json" };
	const fetchOptions = { method, body, headers };
	const apiEndPoint = `https://desktop.vision/api/connect?access_token=${token.access_token}`;
	const res = await fetch(apiEndPoint, fetchOptions);
	const { roomOptions } = await res.json();

	createComputerConnection(roomOptions)
}

function createComputerConnection(connectionOptions) {
	if (computerConnection) computerConnection = null;
	computerConnection = new ComputerConnection(connectionOptions);
	computerConnection.on("stream-added", (newStream) => {
		const video = document.getElementById("video-stream");
		video.setAttribute('webkit-playsinline', 'webkit-playsinline');
		video.setAttribute('playsinline', 'playsinline');
		video.srcObject = newStream;
		video.muted = false
		video.play();

		createComputer();
	});
}

function removeComputer() {
	if (desktop) desktop.destroy()
}

function createComputer() {
	removeComputer()
	const video = document.getElementById("video-stream");
	const sceneContainer = document.getElementById("scene-container");

	const desktopOptions = {
		renderScreenBack: true,
		initialScalar: 0.5,
		initialPosition: { x: 0, y: 0, z: 1 },
		hideMoveIcon: false,
		hideResizeIcon: false,
		includeKeyboard: true,
		grabDistance: 1,
		renderAsLayer: false,
		keyboardOptions: {
			hideMoveIcon: false,
			hideResizeIcon: false,
			keyColor: 'rgb(200, 100, 100)',
			highlightColor: 'rgb(250, 50, 50)'
		}, 
		xrOptions: {
			hideControllers: false,
			hideHands: false,
			hideCursors: false
		}
	}

	desktop = new Computer(scene, sceneContainer, video, renderer, computerConnection, camera, desktopOptions);
	desktop.position.y = 1.6
	desktop.position.z = -1

	scene.add(desktop);
}

function createTestComputer() {
	const video = document.getElementById("video-stream")
	video.setAttribute('webkit-playsinline', 'webkit-playsinline');
	video.setAttribute('playsinline', 'playsinline');
	video.src = '/dvVid.mp4';
	video.muted = true
	video.play();

	createComputer()
}