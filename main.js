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
const attractorColors = {
    icono:   0xef4444, // Rojo
    indice:  0x22c56e, // Verde
    simbolo: 0x38bdf8  // Azul
};

// NUEVO: Variables para el Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const geometries = {
    Rheme: new THREE.SphereGeometry(10, 32, 16),
    Dicent: new THREE.ConeGeometry(10, 20, 32),
    Argument: new THREE.OctahedronGeometry(10, 0)
};
const logicToShapeName = { Rheme: 'Esfera', Dicent: 'Cono', Argument: 'Octaedro' };

const materials = {
    default: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    attractor: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    text: new THREE.MeshBasicMaterial({ color: 0xffffff })
};

const auraGeometry = new THREE.SphereGeometry(12, 32, 16);
const auraMaterial = new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true });
const selectionAura = new THREE.Mesh(auraGeometry, auraMaterial);


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
    camera.position.set(0, 0, 450);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    selectionAura.visible = false;
    scene.add(selectionAura);

    setupPrismVisuals();
    window.addEventListener('resize', onWindowResize);
    
    // NUEVO: Añadimos el listener para el clic del mouse en el canvas.
    renderer.domElement.addEventListener('click', onCanvasClick);
    
    animate();
}

function setupPrismVisuals() {
    const radius = planeSize / 2;
    attractorPositions.icono = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(150)), radius * Math.sin(THREE.MathUtils.degToRad(150)), 0);
    attractorPositions.indice = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(30)), radius * Math.sin(THREE.MathUtils.degToRad(30)), 0);
    attractorPositions.simbolo = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(270)), radius * Math.sin(THREE.MathUtils.degToRad(270)), 0);
    
    for (const key in attractorPositions) {
        const color = attractorColors[key];
        const pos = attractorPositions[key];
        const pointLight = new THREE.PointLight(color, 2, planeSize * 2);
        pointLight.position.copy(pos);
        scene.add(pointLight);
    }
    
    const gridHelper = new THREE.GridHelper(planeSize, 10, 0x888888, 0x444444);
    const planes = [ { z: 0, label: 'Sinsigno' }, { z: 150, label: 'Legisigno' }, { z: -150, label: 'Qualisigno' } ];

    planes.forEach(p => {
        const grid = gridHelper.clone();
        grid.position.z = p.z;
        grid.rotation.x = Math.PI / 2;
        scene.add(grid);
        create3DText(p.label, new THREE.Vector3(-planeSize / 2 - 80, -planeSize / 2, p.z), 0xffffff, 12);
    });

    for (const key in attractorPositions) {
        const pos = attractorPositions[key];
        const color = attractorColors[key];
        const attractorMesh = new THREE.Mesh(new THREE.SphereGeometry(8), materials.attractor.clone());
        attractorMesh.material.color.setHex(color);
        attractorMesh.position.copy(pos);
        scene.add(attractorMesh);
        const labelText = key.charAt(0).toUpperCase() + key.slice(1);
        const labelPos = pos.clone().add(new THREE.Vector3(0, 20, 0));
        create3DText(labelText, labelPos, color, 10);
    }
}

function create3DText(text, position, color, size) {
    if (!font) return;
    const textGeo = new TextGeometry(text, { font, size, height: 2 });
    textGeo.center();
    const textMesh = new THREE.Mesh(textGeo, materials.text.clone());
    textMesh.material.color.setHex(color);
    textMesh.position.copy(position);
    scene.add(textMesh);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// NUEVO: Función para manejar los clics en la escena 3D.
function onCanvasClick(event) {
    // Calcula la posición del mouse en coordenadas normalizadas (-1 a +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Actualiza el raycaster con la cámara y la posición del mouse
    raycaster.setFromCamera(mouse, camera);

    // Obtiene la lista de objetos que el rayo intersecta.
    // Solo nos interesan los objetos que son 'hijos' directos de la escena.
    const intersects = raycaster.intersectObjects(scene.children);

    let foundPoint = null;
    if (intersects.length > 0) {
        // Recorremos los objetos intersectados.
        for (const intersect of intersects) {
            // Buscamos si el objeto 3D intersectado (intersect.object) 
            // corresponde a algún 'mesh' de nuestros puntos.
            const point = points.find(p => p.mesh === intersect.object);
            if (point) {
                foundPoint = point;
                break; // Si encontramos uno, dejamos de buscar.
            }
        }
    }
    
    // Si encontramos un punto, lo seleccionamos.
    // Si no (foundPoint es null), deseleccionamos el actual.
    selectPoint(foundPoint);
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
            selectedPoint = null;
            selectionAura.visible = false;
        }
        updatePointList();
    }
}

function selectPoint(pointToSelect) {
    // Si hacemos clic en el mismo punto que ya está seleccionado, no hacemos nada.
    if (selectedPoint && pointToSelect && selectedPoint.id === pointToSelect.id) {
        return;
    }
    
    selectedPoint = pointToSelect;
    
    if (selectedPoint) {
        selectionAura.position.copy(selectedPoint.mesh.position);
        selectionAura.visible = true;
        updateUIFromPoint(selectedPoint);
    } else {
        selectionAura.visible = false;
        // Si no seleccionamos nada, reseteamos la UI a los valores por defecto.
        onControlsChange(); 
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
        
        selectionAura.position.copy(selectedPoint.mesh.position);

        if (selectedPoint.mesh.geometry !== geometries[selectedPoint.values.logic]) {
            selectedPoint.mesh.geometry.dispose();
            selectedPoint.mesh.geometry = geometries[selectedPoint.values.logic];
            if (selectedPoint.values.logic === 'Dicent') selectedPoint.mesh.rotation.x = -Math.PI / 2;
            else selectedPoint.mesh.rotation.x = 0;
        }
    }
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
    const y = pI.y * wI + pD.y * wD + pS.y * wS;

    let z = 0;
    if (values.type === 'Legisign') z = 150;
    if (values.type === 'Qualisign') z = -150;

    return new THREE.Vector3(x, y, z);
}
