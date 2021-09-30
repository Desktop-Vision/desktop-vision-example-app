import Cubes from '../src/misc/Cubes'
import Lights from '../src/misc/Lights'

import * as THREE from 'three';
window.THREE = THREE

const DV = window.DV
const { DVThree } = DV
const { Computer, ComputerConnection, Keyboard, MouseControls,  TouchControls, KeyboardControls, XRControls } = DVThree;

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

const clientID = "6wlqRxEgp60JXkcGkLY2"; //must match the api key used on the server

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
const camera = new THREE.PerspectiveCamera();
const cubes = new Cubes(scene)
const lights = new Lights(scene)

const keyboardOptions = {
	initialPosition: { x: 0, y: -0.25, z: 0 },
	initialScalar: 0.125,
	hideMoveIcon: false,
	hideResizeIcon: false,
}

const desktopOptions = {
	renderScreenBack: true,
	initialScalar: 0.00025,
	hideMoveIcon: false,
	hideResizeIcon: false,
	includeKeyboard: true,
	grabDistance: 1,
}

const xrControlsOptions = {
	hideHands: false,
	hideControllers: false
}


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
	cubes.addToScene()
	lights.addToScene()
}

function render(time) {
	if (desktop) desktop.update();
	if (keyboard) keyboard.update();
	if (mouseControls) mouseControls.update();
	if (xrControls) xrControls.update();

	if (cubes) cubes.animate(time)

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

	window.location.href = `https://desktop.vision/login/?response_type=code&client_id=${clientID}&scope=${scope}&redirect_uri=${redirectUri}&selectComputer=${selectComputer}`;
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
		video.srcObject = newStream;
		video.muted = true
		video.play();

		removeComputer()
		createComputer();
	});
}

function removeComputer() {
	if (desktop) desktop.remove()
	if (xrControls) xrControls.remove()
	if (mouseControls) mouseControls.remove()
}

function createComputer() {
	const video = document.getElementById("video-stream");
	const sceneContainer = document.getElementById("scene-container");

	desktop = new Computer(video, renderer, computerConnection, camera, false, desktopOptions);
	keyboard = new Keyboard(computerConnection, camera, keyboardOptions)
	xrControls = new XRControls(renderer, camera, scene, desktop, [], xrControlsOptions);
	mouseControls = new MouseControls(camera, desktop, sceneContainer);
	touchControls = new TouchControls(camera, desktop, sceneContainer);
	keyboardControls = new KeyboardControls(desktop)

	desktop.setPosition({ x: 0, y: 1.6, z: -1 });
	desktop.keyboard = keyboard

	scene.add(desktop.object3d);
	scene.add(xrControls.object3d)
}

function createTestComputer(){
	const video = document.getElementById("video-stream");
	video.src = '/dvVid.mp4';
	video.muted = true
	video.play();

	removeComputer()
	createComputer()
}