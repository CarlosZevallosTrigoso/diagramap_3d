import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// --- ESTADO GLOBAL Y CONSTANTES ---
const planeSize = 400;
let scene, camera, renderer, controls, font;
let points = [];
let selectedPoint = null;
// CAMBIO: Variable para guardar el estado original del material antes de hacerlo brillar
let originalEmissive = { color: new THREE.Color(0x000000), intensity: 0 };

const attractorPositions = {};
const attractorColors = {
    icono:   0xef4444, // Rojo
    indice:  0x22c56e, // Verde
    simbolo: 0x38bdf8  // Azul
};

const attractorColorsRGB = {
    icono:   new THREE.Color(attractorColors.icono),
    indice:  new THREE.Color(attractorColors.indice),
    simbolo: new THREE.Color(attractorColors.simbolo)
};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const geometries = {
    Rheme: new THREE.SphereGeometry(10, 32, 16),
    Dicent: new THREE.ConeGeometry(10, 20, 32),
    Argument: new THREE.OctahedronGeometry(10, 0)
};
const logicToShapeName = { Rheme: 'Esfera', Dicent: 'Cono', Argument: 'Octaedro' };

const materials = {
    default: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide }),
    attractor: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    text: new THREE.MeshBasicMaterial({ color: 0xffffff })
};

// --- AURA DE SELECCIÓN ELIMINADA ---

const ui = {
    sliders: { icono: document.getElementById('icono'), indice: document.getElementById('indice'), simbolo: document.getElementById('simbolo') },
    values: { icono: document.getElementById('iconoVal'), indice: document.getElementById('indiceVal'), simbolo: document.getElementById('simboloVal') },
    selects: { type: document.getElementById('type-select'), logic: document.getElementById('logic-select') },
    addBtn: document.getElementById('addBtn'),
    itemList: document.getElementById('item-list'),
    shapeName: document.getElementById('shape-name')
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
    camera.position.set(250, 250, 250);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Ligeramente más luz ambiente
    scene.add(ambientLight);
    
    // --- AURA DE SELECCIÓN ELIMINADA DE LA ESCENA ---

    setupPrismVisuals();
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onCanvasClick);
    
    animate();
}

// CAMBIO: La función ahora acepta un color para el plano de fondo.
function createTernaryGrid(radius, divisions, planeColor) {
    const group = new THREE.Group();
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });

    const v1 = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(150)), 0, radius * Math.sin(THREE.MathUtils.degToRad(150)));
    const v2 = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(30)), 0, radius * Math.sin(THREE.MathUtils.degToRad(30)));
    const v3 = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(270)), 0, radius * Math.sin(THREE.MathUtils.degToRad(270)));
    
    // NUEVO: Crear el plano de fondo coloreado
    if (planeColor) {
        const planeGeometry = new THREE.BufferGeometry().setFromPoints([v1, v2, v3]);
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: planeColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.15
        });
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        group.add(planeMesh);
    }

    const vertices = [v1, v2, v3, v1];
    let geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    group.add(new THREE.Line(geometry, lineMaterial));

    for (let i = 1; i < divisions; i++) {
        const t = i / divisions;
        const p12 = new THREE.Vector3().lerpVectors(v1, v2, t);
        const p13 = new THREE.Vector3().lerpVectors(v1, v3, t);
        const p23 = new THREE.Vector3().lerpVectors(v2, v3, t);
        const p21 = new THREE.Vector3().lerpVectors(v2, v1, t);
        const p31 = new THREE.Vector3().lerpVectors(v3, v1, t);
        const p32 = new THREE.Vector3().lerpVectors(v3, v2, t);
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p12, p13]), lineMaterial));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p23, p21]), lineMaterial));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p31, p32]), lineMaterial));
    }
    return group;
}


function setupPrismVisuals() {
    const radius = planeSize / 2;

    attractorPositions.icono = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(150)), 0, radius * Math.sin(THREE.MathUtils.degToRad(150)));
    attractorPositions.indice = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(30)), 0, radius * Math.sin(THREE.MathUtils.degToRad(30)));
    attractorPositions.simbolo = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(270)), 0, radius * Math.sin(THREE.MathUtils.degToRad(270)));
    
    for (const key in attractorPositions) {
        const color = attractorColors[key];
        const pos = attractorPositions[key];
        const pointLight = new THREE.PointLight(color, 2, planeSize * 3);
        pointLight.position.copy(pos).add(new THREE.Vector3(0, 50, 0));
        scene.add(pointLight);
    }
    
    // CAMBIO: Se definen los colores para cada plano
    const planes = [
        { y: 0,   label: 'Sinsigno',   color: 0x90ee90 }, // Verde claro
        { y: 150, label: 'Legisigno',  color: 0xf08080 }, // Rojo claro
        { y: -150,label: 'Qualisigno', color: 0xf08080 }  // Rojo claro
    ];

    planes.forEach(p => {
        // CAMBIO: Pasamos el color a la función que crea la rejilla
        const grid = createTernaryGrid(radius, 10, p.color);
        grid.position.y = p.y;
        scene.add(grid);
        // --- TEXTOS 3D ELIMINADOS ---
    });

    for (const key in attractorPositions) {
        const pos = attractorPositions[key];
        const color = attractorColors[key];
        const attractorMesh = new THREE.Mesh(new THREE.SphereGeometry(8), materials.attractor.clone());
        attractorMesh.material.color.setHex(color);
        attractorMesh.position.copy(pos);
        scene.add(attractorMesh);
        // --- TEXTOS 3D ELIMINADOS ---
    }
}

// --- FUNCIÓN create3DText ELIMINADA O COMENTADA (YA NO SE USA) ---
/*
function create3DText(...) { ... }
*/

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onCanvasClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(points.map(p => p.mesh)); // Intersectar solo con los puntos
    
    selectPoint(intersects.length > 0 ? points.find(p => p.mesh === intersects[0].object) : null);
}


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
    updatePointColor(point);
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
        if (selectedPoint && selectedPoint.id === idToDelete) {
            selectPoint(null); // Deseleccionar
        }
        updatePointList();
    }
}

function selectPoint(pointToSelect) {
    // Si hay un punto previamente seleccionado, restaurar su material
    if (selectedPoint) {
        selectedPoint.mesh.material.emissive.set(originalEmissive.color);
        selectedPoint.mesh.material.emissiveIntensity = originalEmissive.intensity;
    }

    if (pointToSelect && selectedPoint?.id === pointToSelect.id) {
        // Si se hace clic en el mismo punto, deseleccionarlo
        selectedPoint = null;
    } else {
        selectedPoint = pointToSelect;
    }
    
    if (selectedPoint) {
        // Guardar el estado original y hacer que brille
        originalEmissive.color.copy(selectedPoint.mesh.material.emissive);
        originalEmissive.intensity = selectedPoint.mesh.material.emissiveIntensity;

        selectedPoint.mesh.material.emissive.set(0xffffff); // Brillo blanco
        selectedPoint.mesh.material.emissiveIntensity = 0.8;
        
        updateUIFromPoint(selectedPoint);
    }
    
    updatePointList();
}


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
    ui.shapeName.textContent = `(${logicToShapeName[point.values.logic]})`;
}

function onControlsChange() {
    for (const key in ui.sliders) {
        ui.values[key].textContent = `${ui.sliders[key].value}/100`;
    }
    ui.shapeName.textContent = `(${logicToShapeName[ui.selects.logic.value]})`;
    if (selectedPoint) {
        selectedPoint.values.icono = parseInt(ui.sliders.icono.value);
        selectedPoint.values.indice = parseInt(ui.sliders.indice.value);
        selectedPoint.values.simbolo = parseInt(ui.sliders.simbolo.value);
        selectedPoint.values.type = ui.selects.type.value;
        selectedPoint.values.logic = ui.selects.logic.value;
        selectedPoint.mesh.position.copy(valuesToPosition(selectedPoint.values));
        updatePointColor(selectedPoint);
        if (selectedPoint.mesh.geometry !== geometries[selectedPoint.values.logic]) {
            selectedPoint.mesh.geometry.dispose();
            selectedPoint.mesh.geometry = geometries[selectedPoint.values.logic];
            if (selectedPoint.values.logic === 'Dicent') selectedPoint.mesh.rotation.x = -Math.PI / 2;
            else selectedPoint.mesh.rotation.x = 0;
        }
    }
}

function updatePointColor(point) {
    if (!point) return;
    const { icono, indice, simbolo } = point.values;
    const sum = icono + indice + simbolo || 1;
    const wI = icono / sum;
    const wD = indice / sum;
    const wS = simbolo / sum;

    // CAMBIO: Aumentado el factor para colores más intensos.
    const colorFactor = 2.2; 
    
    const finalColor = new THREE.Color(0x000000);
    finalColor.add(attractorColorsRGB.icono.clone().multiplyScalar(wI * colorFactor));
    finalColor.add(attractorColorsRGB.indice.clone().multiplyScalar(wD * colorFactor));
    finalColor.add(attractorColorsRGB.simbolo.clone().multiplyScalar(wS * colorFactor));

    point.mesh.material.color.set(finalColor);
}

function setupUIListeners() {
    ui.addBtn.addEventListener('click', addPoint);
    for (const key in ui.sliders) ui.sliders[key].addEventListener('input', onControlsChange);
    for (const key in ui.selects) ui.selects[key].addEventListener('change', onControlsChange);
    onControlsChange();
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
    const z = pI.z * wI + pD.z * wD + pS.z * wS;

    let y = 0;
    if (values.type === 'Legisigno') y = 150;
    if (values.type === 'Qualisigno') y = -150;

    return new THREE.Vector3(x, y, z);
}
