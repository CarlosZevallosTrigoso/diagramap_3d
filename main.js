import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- ESTADO GLOBAL Y CONSTANTES ---
const spaceSize = 200;
let scene, camera, renderer, controls;
let points = [];
let selectedPoint = null;

// Materiales para los puntos
const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.5 });
const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, emissive: 0xfacc15, emissiveIntensity: 0.5 });

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
    addBtn: document.getElementById('addBtn'),
    itemList: document.getElementById('item-list')
};

// --- INICIALIZACIÓN ---
init();
setupUIListeners();

function init() {
    // Escena
    scene = new THREE.Scene();

    // Cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(250, 200, 250);
    camera.lookAt(0, 0, 0);

    // Renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Controles de cámara
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Ejes visuales
    const axesHelper = new THREE.AxesHelper(spaceSize);
    scene.add(axesHelper);

    // Evento de redimensionamiento
    window.addEventListener('resize', onWindowResize);

    // Iniciar bucle de animación
    animate();
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
        simbolo: parseInt(ui.sliders.simbolo.value)
    };

    const geometry = new THREE.SphereGeometry(10, 32, 16);
    const mesh = new THREE.Mesh(geometry, defaultMaterial.clone());
    mesh.position.copy(valuesToPosition(values));

    const point = { id: THREE.MathUtils.generateUUID(), name, values, mesh };
    
    points.push(point);
    scene.add(mesh);

    updatePointList();
    selectPoint(point);
}

function deletePoint(idToDelete) {
    const index = points.findIndex(p => p.id === idToDelete);
    if (index === -1) return;

    const pointToDelete = points[index];
    scene.remove(pointToDelete.mesh);
    pointToDelete.mesh.geometry.dispose();
    pointToDelete.mesh.material.dispose();

    points.splice(index, 1);

    if (selectedPoint && selectedPoint.id === idToDelete) {
        selectedPoint = null;
    }
    
    updatePointList();
}


function selectPoint(pointToSelect) {
    // Deseleccionar el punto anterior
    if (selectedPoint) {
        selectedPoint.mesh.material = defaultMaterial;
    }

    // Seleccionar el nuevo punto
    selectedPoint = pointToSelect;
    selectedPoint.mesh.material = selectedMaterial;

    updateSlidersFromPoint(selectedPoint);
    updatePointList();
}

// --- ACTUALIZACIÓN DE UI Y DATOS ---
function updatePointList() {
    ui.itemList.innerHTML = '';
    points.forEach(point => {
        const itemEl = document.createElement('div');
        itemEl.className = 'list-item';
        if (selectedPoint && point.id === selectedPoint.id) {
            itemEl.classList.add('selected');
        }
        
        const nameEl = document.createElement('span');
        nameEl.textContent = point.name;
        itemEl.appendChild(nameEl);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deletePoint(point.id);
        };
        itemEl.appendChild(deleteBtn);

        itemEl.onclick = () => selectPoint(point);
        ui.itemList.appendChild(itemEl);
    });
}

function updateSlidersFromPoint(point) {
    for (const key in ui.sliders) {
        ui.sliders[key].value = point.values[key];
        ui.values[key].textContent = `${point.values[key]}/100`;
    }
}

function onSliderChange() {
    for (const key in ui.sliders) {
        ui.values[key].textContent = `${ui.sliders[key].value}/100`;
    }

    if (selectedPoint) {
        selectedPoint.values.icono = parseInt(ui.sliders.icono.value);
        selectedPoint.values.indice = parseInt(ui.sliders.indice.value);
        selectedPoint.values.simbolo = parseInt(ui.sliders.simbolo.value);
        selectedPoint.mesh.position.copy(valuesToPosition(selectedPoint.values));
    }
}

// --- LISTENERS Y HELPERS ---
function setupUIListeners() {
    ui.addBtn.addEventListener('click', addPoint);
    for (const key in ui.sliders) {
        ui.sliders[key].addEventListener('input', onSliderChange);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function valuesToPosition(values) {
    const x = THREE.MathUtils.mapLinear(values.icono, 1, 100, -spaceSize, spaceSize);
    const y = THREE.MathUtils.mapLinear(values.indice, 1, 100, -spaceSize, spaceSize);
    const z = THREE.MathUtils.mapLinear(values.simbolo, 1, 100, -spaceSize, spaceSize);
    return new THREE.Vector3(x, y, z);
}
