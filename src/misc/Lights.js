import * as THREE from 'three';
export default class lights {

    constructor(scene) {
        this.scene = scene
        this.createLights()
    }

    createLights() {
        const topLight = new THREE.DirectionalLight(0x081425, 1);
        const bottomLight = new THREE.DirectionalLight(0x57FFF2, 1);
        const backLight = new THREE.DirectionalLight(0xffffff, 1);

        backLight.position.set(0, 2, -2);
        topLight.position.set(0, 2, 2);
        bottomLight.position.set(0, -2, 2);

        this.topLight = topLight
        this.bottomLight = bottomLight
        this.backLight = backLight

        const color = 0xFFFFFF;
        const intensity = 0.5;
        this.ambientlight = new THREE.AmbientLight(color, intensity);
    }

    addToScene() {
        const { scene, backLight, topLight, bottomLight, ambientlight} = this
        scene.add(backLight);
        scene.add(topLight);
        scene.add(bottomLight);
        scene.add(ambientlight)
    }
}