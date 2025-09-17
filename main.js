import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// --- ESTADO GLOBAL Y CONSTANTES ---
const planeSize = 400;
let scene, camera, renderer, controls, font;
let points = [];
let selectedPoint = null;
const attractorPositions = {};

const geometries = {
    Rheme: new THREE.SphereGeometry(10, 32, 16),
    Dicent: new THREE.ConeGeometry(10, 20, 32),
    Argument: new THREE.OctahedronGeometry(10, 0)
};
const materials = {
    default: new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.5 }),
    selected: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, emissive: 0xfacc15, emissiveIntensity: 0.5 }),
    attractor: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    text: new THREE.MeshBasicMaterial({ color: 0xffffff })
};

// Referencias al DOM
const ui = {
    sliders: {
        icono: document.getElementById('icono'),
        indice: document.getElementById('indice'),
        simbolo: document.getElementById('simbolo')
    },
    values: {
        icono: document.getElementById('iconoVal'),
        indice: document.getElementById('indiceVal'),
        simbolo: document.getElementById('simboloVal')
    },
    selects: {
        type: document.getElementById('type-select'),
        logic: document.getElementById('logic-select')
    },
    addBtn: document.getElementById('addBtn'),
    itemList: document.getElementById('item-list')
};

// --- INICIALIZACIÓN ---
const fontLoader = new FontLoader();
fontLoader.load('https://unpkg.com/three@0.158.0/examples/fonts/helvetiker_regular.typeface.json', (loadedFont) => {
    font = loadedFont;
    init();
    setupUIListeners();
});

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 0, 450);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(150, 200, 300);
    scene.add(directionalLight);

    setupPrismVisuals();

    window.addEventListener('resize', onWindowResize);
    animate();
}

// --- CONFIGURACIÓN VISUAL DEL PRISMA ---
function setupPrismVisuals() {
    const radius = planeSize / 2;
    attractorPositions.icono = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(150)), radius * Math.sin(THREE.MathUtils.degToRad(150)), 0);
    attractorPositions.indice = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(30)), radius * Math.sin(THREE.MathUtils.degToRad(30)), 0);
    attractorPositions.simbolo = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(270)), radius * Math.sin(THREE.MathUtils.degToRad(270)), 0);

    const gridHelper = new THREE.GridHelper(planeSize, 10, 0xcccccc, 0x888888);
    
    // Plano Sinsigno (Central)
    const sinsignPlane = gridHelper.clone();
    sinsignPlane.position.z = 0;
    scene.add(sinsignPlane);
    create3DText('Sinsigno', new THREE.Vector3(-planeSize / 2 - 80, -planeSize / 2, 0), 0xffffff, 12);

    // Plano Legisigno (Superior)
    const legisignPlane = gridHelper.clone();
    legisignPlane.position.z = 150;
    scene.add(legisignPlane);
    create3DText('Legisigno', new THREE.Vector3(-planeSize / 2 - 80, -planeSize / 2, 150), 0xffffff, 12);

    // Plano Qualisigno (Inferior)
    const qualisignPlane = gridHelper.clone();
    qualisignPlane.position.z = -150;
    scene.add(qualisignPlane);
    create3DText('Qualisigno', new THREE.Vector3(-planeSize / 2 - 90, -planeSize / 2, -150), 0xffffff, 12);

    // Dibujar Atractores y sus Etiquetas
    for (const key in attractorPositions) {
        const pos = attractorPositions[key];
        const color = key === 'icono' ? 0xef4444 : key === 'indice' ? 0x22c56e : 0x38bdf8;
        
        const attractorMesh = new THREE.Mesh(new THREE.SphereGeometry(8), materials.attractor.clone());
        attractorMesh.material.color.setHex(color);
        attractorMesh.position.copy(pos);
        sinsignPlane.add(attractorMesh);

        const labelText = key.charAt(0).toUpperCase() + key.slice(1);
        const labelPos = pos.clone().add(new THREE.Vector3(0, 20, 0));
        create3DText(labelText, labelPos, color, 10);
    }
}

function create3DText(text, position, color, size) {
    if (!font) return;
    const textGeo = new TextGeometry(text, { font, size, height: 2 });
    const textMesh = new THREE.Mesh(textGeo, materials.text.clone());
    textMesh.material.color.setHex(color);
    textMesh.position.copy(position);
    textGeo.center(); // Centra el texto en su origen
    scene.add(textMesh);
}

// --- BUCLE DE ANIMACIÓN ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- LÓGICA DE LA APLICACIÓN ---
function addPoint() {
    const name = prompt("Ingresa un nombre para el nuevo elemento:", "Elemento sin título");
    if (!name || name.trim() === "") return;

    const values = {
        icono: parseInt(ui.sliders.icono.value),
        indice: parseInt(ui.sliders.indice.value),
        simbolo: parseInt(ui.sliders.simbolo.value),
        type: ui.selects.type.value,
        logic: ui.selects.logic.value
    };

    const geometry = geometries[values.logic];
    const mesh = new THREE.Mesh(geometry, materials.default.clone());
    mesh.position.copy(valuesToPosition(values));
    if (values.logic === 'Dicent') mesh.rotation.x = -Math.PI / 2;

    const point = { id: THREE.MathUtils.generateUUID(), name, values, mesh };
    
    points.push(point);
    scene.add(mesh);
    updatePointList();
    selectPoint(point);
}

function deletePoint(idToDelete) {
    const index = points.findIndex(p => p.id === idToDelete);
    if (index > -1) {
        const point = points[index];
        scene.remove(point.mesh);
        point.mesh.geometry.dispose();
        point.mesh.material.dispose();
        points.splice(index, 1);
        if (selectedPoint && selectedPoint.id === idToDelete) selectedPoint = null;
        updatePointList();
    }
}

function selectPoint(pointToSelect) {
    if (selectedPoint) selectedPoint.mesh.material = materials.default;
    selectedPoint = pointToSelect;
    if (selectedPoint) {
        selectedPoint.mesh.material = materials.selected;
        updateUIFromPoint(selectedPoint);
    }
    updatePointList();
}

// --- ACTUALIZACIÓN DE UI Y DATOS ---
function updatePointList() {
    ui.itemList.innerHTML = '';
    points.forEach(point => {
        const itemEl = document.createElement('div');
        itemEl.className = 'list-item';
        if (selectedPoint && point.id === selectedPoint.id) itemEl.classList.add('selected');
        
        itemEl.innerHTML = `<span>${point.name}</span><button class="delete-btn">X</button>`;
        
        itemEl.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); deletePoint(point.id); };
        itemEl.onclick = () => selectPoint(point);
        ui.itemList.appendChild(itemEl);
    });
}

function updateUIFromPoint(point) {
    for (const key in ui.sliders) {
        ui.sliders[key].value = point.values[key];
        ui.values[key].textContent = `${point.values[key]}/100`;
    }
    ui.selects.type.value = point.values.type;
    ui.selects.logic.value = point.values.logic;
}

function onControlsChange() {
    for (const key in ui.sliders) {
        ui.values[key].textContent = `${ui.sliders[key].value}/100`;
    }

    if (selectedPoint) {
        selectedPoint.values.icono = parseInt(ui.sliders.icono.value);
        selectedPoint.values.indice = parseInt(ui.sliders.indice.value);
        selectedPoint.values.simbolo = parseInt(ui.sliders.simbolo.value);
        selectedPoint.values.type = ui.selects.type.value;
        selectedPoint.values.logic = ui.selects.logic.value;
        
        selectedPoint.mesh.position.copy(valuesToPosition(selectedPoint.values));
        if (selectedPoint.mesh.geometry !== geometries[selectedPoint.values.logic]) {
            selectedPoint.mesh.geometry.dispose();
            selectedPoint.mesh.geometry = geometries[selectedPoint.values.logic];
            if (selectedPoint.values.logic === 'Dicent') selectedPoint.mesh.rotation.x = -Math.PI / 2;
            else selectedPoint.mesh.rotation.x = 0;
        }
    }
}

// --- LISTENERS Y HELPERS ---
function setupUIListeners() {
    ui.addBtn.addEventListener('click', addPoint);
    for (const key in ui.sliders) ui.sliders[key].addEventListener('input', onControlsChange);
    for (const key in ui.selects) ui.selects[key].addEventListener('change', onControlsChange);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function valuesToPosition(values) {
    const { icono, indice, simbolo } = values;
    const sum = icono + indice + simbolo || 1;
    const wI = icono / sum;
    const wD = indice / sum;
    const wS = simbolo / sum;

    const pI = attractorPositions.icono;
    const pD = attractorPositions.indice;
    const pS = attractorPositions.simbolo;

    const x = pI.x * wI + pD.x * wD + pS.x * wS;
    const y = pI.y * wI + pD.y * wD + pS.y * wS;

    let z = 0;
    if (values.type === 'Legisign') z = 150;
    if (values.type === 'Qualisign') z = -150;

    return new THREE.Vector3(x, y, z);
}
