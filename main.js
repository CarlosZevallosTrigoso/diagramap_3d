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

// CAMBIO: Material del aura de selección: color más suave, opacidad reducida.
const auraGeometry = new THREE.SphereGeometry(12, 32, 16);
const auraMaterial = new THREE.MeshBasicMaterial({ color: 0xADD8E6, wireframe: true, transparent: true, opacity: 0.4 }); // Azul claro, más transparente
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
    camera.position.set(250, 250, 250);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    selectionAura.visible = false;
    scene.add(selectionAura);

    setupPrismVisuals();
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onCanvasClick);
    
    animate();
}

function createTernaryGrid(radius, divisions) {
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.5 });

    const v1 = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(150)), 0, radius * Math.sin(THREE.MathUtils.degToRad(150)));
    const v2 = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(30)), 0, radius * Math.sin(THREE.MathUtils.degToRad(30)));
    const v3 = new THREE.Vector3(radius * Math.cos(THREE.MathUtils.degToRad(270)), 0, radius * Math.sin(THREE.MathUtils.degToRad(270)));
    
    const vertices = [v1, v2, v3, v1];
    let geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    group.add(new THREE.Line(geometry, material));

    for (let i = 1; i <= divisions; i++) {
        const t = i / divisions;
        
        const p12 = new THREE.Vector3().lerpVectors(v1, v2, t);
        const p13 = new THREE.Vector3().lerpVectors(v1, v3, t);
        const p23 = new THREE.Vector3().lerpVectors(v2, v3, t);
        const p21 = new THREE.Vector3().lerpVectors(v2, v1, t);
        const p31 = new THREE.Vector3().lerpVectors(v3, v1, t);
        const p32 = new THREE.Vector3().lerpVectors(v3, v2, t);

        let line1_geom = new THREE.BufferGeometry().setFromPoints([p12, p13]);
        let line2_geom = new THREE.BufferGeometry().setFromPoints([p23, p21]);
        let line3_geom = new THREE.BufferGeometry().setFromPoints([p31, p32]);
        
        group.add(new THREE.Line(line1_geom, material));
        group.add(new THREE.Line(line2_geom, material));
        group.add(new THREE.Line(line3_geom, material));
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
    
    const planes = [
        { y: 0,   label: 'Sinsigno' },
        { y: 150, label: 'Legisigno' },
        { y: -150,label: 'Qualisigno' }
    ];

    const ternaryGrid = createTernaryGrid(radius, 10);

    planes.forEach(p => {
        const grid = ternaryGrid.clone();
        grid.position.y = p.y;
        scene.add(grid);
        create3DText(p.label, new THREE.Vector3(-radius - 80, p.y, 0), 0xffffff, 12);
    });

    for (const key in attractorPositions) {
        const pos = attractorPositions[key];
        const color = attractorColors[key];
        const attractorMesh = new THREE.Mesh(new THREE.SphereGeometry(8), materials.attractor.clone());
        attractorMesh.material.color.setHex(color);
        attractorMesh.position.copy(pos);
        scene.add(attractorMesh);
        
        const labelText = key.charAt(0).toUpperCase() + key.slice(1);
        const labelPos = pos.clone().add(new THREE.Vector3(0, 0, key === 'simbolo' ? 30 : -20));
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
    textMesh.quaternion.copy(camera.quaternion);
    scene.add(textMesh);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    // CAMBIO: Asegurarse de que los textos siempre miren a la cámara durante la animación.
    points.forEach(p => {
        p.mesh.children.forEach(child => { // Si tuvieras texto adjunto a los puntos
            if (child.isMesh && child.geometry instanceof TextGeometry) {
                child.quaternion.copy(camera.quaternion);
            }
        });
    });
    scene.children.forEach(child => { // Y para los textos fijos de los planos
        if(child.isMesh && child.geometry instanceof TextGeometry) {
             child.quaternion.copy(camera.quaternion);
        }
    });

    renderer.render(scene, camera);
}

function onCanvasClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    let foundPoint = null;
    if (intersects.length > 0) {
        for (const intersect of intersects) {
            const point = points.find(p => p.mesh === intersect.object);
            if (point) {
                foundPoint = point;
                break; 
            }
        }
    }
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
            selectedPoint = null;
            selectionAura.visible = false;
        }
        updatePointList();
    }
}

function selectPoint(pointToSelect) {
    if (selectedPoint && pointToSelect && selectedPoint.id === pointToSelect.id) return;
    selectedPoint = pointToSelect;
    if (selectedPoint) {
        selectionAura.position.copy(selectedPoint.mesh.position);
        selectionAura.visible = true;
        updateUIFromPoint(selectedPoint);
    } else {
        selectionAura.visible = false;
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

    // CAMBIO: Aumentar la influencia de los colores multiplicando los pesos.
    // Usamos un factor de 1.5 para hacer la contribución de cada color más fuerte.
    // Esto es un balance entre saturación y mezcla.
    const colorFactor = 1.5; 
    
    const finalColor = new THREE.Color(0x000000); // Empezamos desde negro
    finalColor.add(attractorColorsRGB.icono.clone().multiplyScalar(wI * colorFactor));
    finalColor.add(attractorColorsRGB.indice.clone().multiplyScalar(wD * colorFactor));
    finalColor.add(attractorColorsRGB.simbolo.clone().multiplyScalar(wS * colorFactor));

    // Asegurarse de que el color no se pase de los límites (0-1)
    finalColor.clampScalar(0, 1);

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
    if (values.type === 'Legisign') y = 150;
    if (values.type === 'Qualisign') y = -150;

    return new THREE.Vector3(x, y, z);
}
