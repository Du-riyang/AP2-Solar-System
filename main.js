
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// 1. 场景、相机和渲染器
const container = document.getElementById('scene-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050e);

const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);

camera.position.set(0, 22, 38);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

let activeCamera = camera;
let isOrthographic = false;

let controls = new OrbitControls(activeCamera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 12;
controls.maxDistance = 85;

// 2. 灯光
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const sunlight = new THREE.PointLight(0xffffff, 180, 100, 1.5);
sunlight.position.set(0, 0, 0);
sunlight.castShadow = true;
scene.add(sunlight);

// 3. 纹理加载
const textureLoader = new THREE.TextureLoader();


function loadTexture(url, fallbackColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(0, 0, 256, 128);

    const fallbackTexture = new THREE.CanvasTexture(canvas);

    return new Promise(resolve => {
        let settled = false;

        const finish = texture => {
            if (settled) return;

            settled = true;
            clearTimeout(timer);
            resolve(texture);
        };

        // 最多等待8秒，超时使用备用纹理
        const timer = setTimeout(() => {
            console.warn('纹理加载超时，启用备用纹理：', url);
            finish(fallbackTexture);
        }, 8000);

        textureLoader.load(
            url,
            texture => finish(texture),
            undefined,
            () => {
                console.warn('纹理加载失败，启用备用纹理：', url);
                finish(fallbackTexture);
            }
        );
    });
}

// 4. 天体层级结构
const earthOrbit = new THREE.Group();
scene.add(earthOrbit);

const earthTilt = new THREE.Group();
earthTilt.position.set(14, 0, 0);
earthOrbit.add(earthTilt);

const moonOrbit = new THREE.Group();
earthTilt.add(moonOrbit);

const moonTilt = new THREE.Group();
moonTilt.position.set(3.5, 0, 0);
moonOrbit.add(moonTilt);

// 5. 创建球体
function createSphere(radius, texture, options = {}) {
    const geometry = new THREE.SphereGeometry(radius, 64, 64);

    const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.9,
        ...options
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    return sphere;
}

// 6. 轨道线
function createOrbit(radius, color) {
    const points = [];

    for (let i = 0; i <= 200; i++) {
        const angle = (i / 200) * Math.PI * 2;

        points.push(new THREE.Vector3(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
        ));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5
    });

    return new THREE.LineLoop(geometry, material);
}

const earthOrbitLine = createOrbit(14, 0x477dff);
const moonOrbitLine = createOrbit(3.5, 0x9aaacc);

scene.add(earthOrbitLine);
earthTilt.add(moonOrbitLine);

// 7. 星空背景
const starGeometry = new THREE.BufferGeometry();
const starPositions = [];

for (let i = 0; i < 2500; i++) {
    starPositions.push(
        (Math.random() - 0.5) * 180,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 180
    );
}

starGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(starPositions, 3)
);

const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 })
);

scene.add(stars);

// 8. 创建太阳、地球和月球
const textureURLs = {
    sun: 'https://threejs.org/examples/textures/planets/sun.jpg',
    earth: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
    moon: 'https://threejs.org/examples/textures/planets/moon_1024.jpg'
};

const textures = await Promise.all([
    loadTexture(textureURLs.sun, '#ff9d25'),
    loadTexture(textureURLs.earth, '#1766a9'),
    loadTexture(textureURLs.moon, '#999999')
]);

const sun = createSphere(3.2, textures[0], {
    emissive: 0xff8a18,
    emissiveIntensity: 1.5
});
scene.add(sun);

const earth = createSphere(1.35, textures[1]);
earthTilt.add(earth);

const moon = createSphere(0.48, textures[2]);
moonTilt.add(moon);

const sunlightMesh = new THREE.PointLight(0xffffff, 180, 100, 1.5);
sunlightMesh.position.set(0, 0, 0);
scene.add(sunlightMesh);

// 9. 手动矩阵组合：月球轨道倾斜和公转
const moonOrbitMatrix = new THREE.Matrix4();

function updateMoonMatrix(angle = 0) {
    const rotationX = new THREE.Matrix4().makeRotationX(
        THREE.MathUtils.degToRad(5)
    );

    const rotationY = new THREE.Matrix4().makeRotationY(angle);

    moonOrbitMatrix.multiplyMatrices(rotationY, rotationX);

    moonOrbit.matrixAutoUpdate = false;
    moonOrbit.matrix.copy(moonOrbitMatrix);
    moonOrbit.matrixWorldNeedsUpdate = true;
}

// 10. 动画参数
let orbitSpeed = 1;
let rotationSpeed = 1;
let moonSpeed = 1;
let tiltAngle = 23.5;

let animationPaused = false;
let cameraRoaming = false;
let elapsed = 0;
let previousTime = performance.now();

// 11. 控制面板
function bindSlider(id, callback, valueId, suffix = '') {
    const input = document.getElementById(id);
    const display = document.getElementById(valueId);

    input.addEventListener('input', () => {
        const value = Number(input.value);
        callback(value);

        if (display) {
            display.textContent = value.toFixed(1) + suffix;
        }
    });
}

bindSlider('orbitSpeed', value => {
    orbitSpeed = value;
}, 'orbitValue');

bindSlider('rotationSpeed', value => {
    rotationSpeed = value;
}, 'rotationValue');

bindSlider('moonSpeed', value => {
    moonSpeed = value;
}, 'moonValue');

bindSlider('tiltAngle', value => {
    tiltAngle = value;
    earthTilt.rotation.z = THREE.MathUtils.degToRad(tiltAngle);
}, 'tiltValue', '°');

document.getElementById('showOrbits').addEventListener('change', event => {
    earthOrbitLine.visible = event.target.checked;
    moonOrbitLine.visible = event.target.checked;
});

// 12. 暂停和继续
const pauseBtn = document.getElementById('pauseBtn');

pauseBtn.addEventListener('click', () => {
    animationPaused = !animationPaused;
    pauseBtn.textContent = animationPaused ? '继续动画' : '暂停动画';

    document.getElementById('animationInfo').textContent =
        animationPaused ? '动画状态：已暂停' : '动画状态：运行中';
});

// 13. 相机漫游
const cameraBtn = document.getElementById('cameraBtn');

cameraBtn.addEventListener('click', () => {
    cameraRoaming = !cameraRoaming;
    cameraBtn.textContent = cameraRoaming ?
        '停止相机漫游' : '开始相机漫游';

    controls.enabled = !cameraRoaming;
});

// 14. 正交和透视投影切换
function switchProjection() {
    const oldCamera = activeCamera;

    if (!isOrthographic) {
        const size = 35;

        activeCamera = new THREE.OrthographicCamera(
            -size * container.clientWidth / container.clientHeight / 2,
            size * container.clientWidth / container.clientHeight / 2,
            size / 2,
            -size / 2,
            0.1,
            1000
        );
    } else {
        activeCamera = new THREE.PerspectiveCamera(
            50,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
    }

    activeCamera.position.copy(oldCamera.position);
    activeCamera.lookAt(0, 0, 0);

    controls.dispose();

    controls = new OrbitControls(activeCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 12;
    controls.maxDistance = 85;
    controls.enabled = !cameraRoaming;

    isOrthographic = !isOrthographic;

    document.getElementById('projectionInfo').textContent =
        isOrthographic ? '当前投影：正交投影' : '当前投影：透视投影';
}

document.getElementById('projectionBtn').addEventListener(
    'click',
    switchProjection
);

// 15. 键盘操作
window.addEventListener('keydown', event => {
    if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
        event.preventDefault();

        animationPaused = !animationPaused;
        pauseBtn.textContent = animationPaused ? '继续动画' : '暂停动画';

        document.getElementById('animationInfo').textContent =
            animationPaused ? '动画状态：已暂停' : '动画状态：运行中';
    }

    if (event.key.toLowerCase() === 'o') {
        switchProjection();
    }
});

// 16. 重置视角
document.getElementById('resetBtn').addEventListener('click', () => {
    cameraRoaming = false;
    cameraBtn.textContent = '开始相机漫游';

    activeCamera.position.set(0, 22, 38);
    activeCamera.lookAt(0, 0, 0);

    controls.enabled = true;
    controls.target.set(0, 0, 0);
    controls.update();
});

// 17. 窗口大小调整
window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.setSize(width, height);

    if (isOrthographic) {
        const size = 35;
        activeCamera.left = -size * width / height / 2;
        activeCamera.right = size * width / height / 2;
        activeCamera.top = size / 2;
        activeCamera.bottom = -size / 2;
    } else {
        activeCamera.aspect = width / height;
    }

    activeCamera.updateProjectionMatrix();
});

// 18. 动画循环
function animate(currentTime) {
    requestAnimationFrame(animate);

    const delta = Math.min((currentTime - previousTime) / 1000, 0.05);
    previousTime = currentTime;

    if (!animationPaused) {
        elapsed += delta;

        // 地球绕太阳公转
        earthOrbit.rotation.y = elapsed * orbitSpeed * 0.35;

        // 地球自转
        earth.rotation.y += delta * rotationSpeed * 0.9;

        // 地球轴倾角
        earthTilt.rotation.z = THREE.MathUtils.degToRad(tiltAngle);

        // 月球轨道：手动矩阵组合
        updateMoonMatrix(elapsed * moonSpeed * 1.2);

        // 月球自转
        moon.rotation.y += delta * rotationSpeed * 0.3;

        // 太阳自转
        sun.rotation.y += delta * 0.12;
    }

    // 相机环绕漫游
    if (cameraRoaming) {
        const angle = elapsed * 0.18;

        activeCamera.position.set(
            Math.sin(angle) * 42,
            17,
            Math.cos(angle) * 42
        );

        activeCamera.lookAt(0, 0, 0);
    } else {
        controls.update();
    }

    renderer.render(scene, activeCamera);
}

// 19. 开始运行
document.getElementById('loading').style.display = 'none';

requestAnimationFrame(animate);

console.log('AP2 Solar System initialized successfully!');
