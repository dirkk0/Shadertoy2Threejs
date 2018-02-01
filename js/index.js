const container = document.body;
const FOV = 45;
const NEAR = 0.1;
const FAR = 1000;
let height = container.clientHeight;
let width = container.clientWidth;
const ASPECT = width / height;
// const resolution = new THREE.Vector2(width, height);
// const SHADOW_MAP_SIZE = 1024;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setClearColor(0x000000);

const canvas = renderer.domElement;

const scene = new THREE.Scene();

const clock = new THREE.Clock();

const camera = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
camera.position.set(-2, 2, 2);
camera.target = new THREE.Vector3(0, 0, 0);

const controls = new THREE.OrbitControls(camera, canvas);

const matNormal = new THREE.MeshNormalMaterial();
const matShadow = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 0.0,
});


const floorGeo = new THREE.PlaneBufferGeometry(2.0, 2.0);
const floor = new THREE.Mesh(floorGeo, matNormal);
floor.position.set(0, -0.5, 0);
floor.rotation.x = -((Math.PI * 90) / 180);

const sphereGeo = new THREE.SphereBufferGeometry(0.5, 32, 32);
const sphere = new THREE.Mesh(sphereGeo, matNormal);

scene.add(floor);
scene.add(sphere);
scene.add(camera);




// ...
renderer.shadowMap.enabled = true;
renderer.shadowMap.renderReverseSided = false;

// ...
floor.receiveShadow = true;

// ...
sphere.castShadow = true;
sphere.receiveShadow = true;

const SHADOW_MAP_SIZE = 1024;

const directionalLight = new THREE.DirectionalLight( 0xffffff, 1.5 );
directionalLight.position.set( -1, 1.75, 1 );
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = SHADOW_MAP_SIZE;
directionalLight.shadow.mapSize.height = SHADOW_MAP_SIZE;
directionalLight.shadow.camera.far = 3500;
directionalLight.shadow.bias = -0.0001;



const PARAMETERS = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBFormat,
    stencilBuffer: false
};

const shadowBuffer = new THREE.WebGLRenderTarget(1, 1, PARAMETERS);





scene.add(directionalLight);






const resolution = new THREE.Vector2(width, height);



const VERTEX = `
    varying vec2 vUv;

    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mvPosition;
        vUv = uv;
    }
`;

const FRAGMENT = `
    uniform sampler2D tDiffuse;
    uniform sampler2D tShadow;
    uniform vec2 iResolution;

    varying vec2 vUv;



    #define Sensitivity (vec2(0.3, 1.5) * iResolution.y / 400.0)

    float checkSame(vec4 center, vec4 samplef)
    {
        vec2 centerNormal = center.xy;
        float centerDepth = center.z;
        vec2 sampleNormal = samplef.xy;
        float sampleDepth = samplef.z;

        vec2 diffNormal = abs(centerNormal - sampleNormal) * Sensitivity.x;
        bool isSameNormal = (diffNormal.x + diffNormal.y) < 0.1;
        float diffDepth = abs(centerDepth - sampleDepth) * Sensitivity.y;
        bool isSameDepth = diffDepth < 0.1;

        return (isSameNormal && isSameDepth) ? 1.0 : 0.0;
    }

    void main( )
    {
        vec4 sample0 = texture2D(tDiffuse, vUv);
        vec4 sample1 = texture2D(tDiffuse, vUv + (vec2(1.0, 1.0) / iResolution.xy));
        vec4 sample2 = texture2D(tDiffuse, vUv + (vec2(-1.0, -1.0) / iResolution.xy));
        vec4 sample3 = texture2D(tDiffuse, vUv + (vec2(-1.0, 1.0) / iResolution.xy));
        vec4 sample4 = texture2D(tDiffuse, vUv + (vec2(1.0, -1.0) / iResolution.xy));

        float edge = checkSame(sample1, sample2) * checkSame(sample3, sample4);

        // gl_FragColor = vec4(edge, sample0.w, 1.0, 1.0);
        float shadow = texture2D(tShadow, vUv).x;
        gl_FragColor = vec4(edge, shadow, 1.0, 1.0);

    }
`;




const drawShader = {
    uniforms: {
        tDiffuse: { type: 't', value: null },
        tShadow: { type: 't', value: null },
        iResolution: { type: 'v2', value: resolution },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
};



    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));

    const pass = new THREE.ShaderPass(drawShader);
    // pass.renderToScreen = true;
    composer.addPass(pass);

 const FRAGMENT_FINAL = `
uniform sampler2D tDiffuse;
uniform sampler2D tNoise;
uniform float iTime;

varying vec2 vUv;

#define EdgeColor vec4(0.2, 0.2, 0.15, 1.0)
#define BackgroundColor vec4(1,0.95,0.85,1)
#define NoiseAmount 0.01
#define ErrorPeriod 30.0
#define ErrorRange 0.003

// Reference: https://www.shadertoy.com/view/MsSGD1
float triangle(float x)
{
    return abs(1.0 - mod(abs(x), 2.0)) * 2.0 - 1.0;
}

float rand(float x)
{
    return fract(sin(x) * 43758.5453);
}

void main()
{
    float time = floor(iTime * 16.0) / 16.0;
    vec2 uv = vUv;
    uv += vec2(triangle(uv.y * rand(time) * 1.0) * rand(time * 1.9) * 0.005,
            triangle(uv.x * rand(time * 3.4) * 1.0) * rand(time * 2.1) * 0.005);

    float noise = (texture2D(tNoise, uv * 0.5).r - 0.5) * NoiseAmount;
    vec2 uvs[3];
    uvs[0] = uv + vec2(ErrorRange * sin(ErrorPeriod * uv.y + 0.0) + noise, ErrorRange * sin(ErrorPeriod * uv.x + 0.0) + noise);
    uvs[1] = uv + vec2(ErrorRange * sin(ErrorPeriod * uv.y + 1.047) + noise, ErrorRange * sin(ErrorPeriod * uv.x + 3.142) + noise);
    uvs[2] = uv + vec2(ErrorRange * sin(ErrorPeriod * uv.y + 2.094) + noise, ErrorRange * sin(ErrorPeriod * uv.x + 1.571) + noise);

    float edge = texture2D(tDiffuse, uvs[0]).r * texture2D(tDiffuse, uvs[1]).r * texture2D(tDiffuse, uvs[2]).r;
    float diffuse = texture2D(tDiffuse, uv).g;

    float w = fwidth(diffuse) * 2.0;
    vec4 mCol = mix(BackgroundColor * 0.5, BackgroundColor, mix(0.0, 1.0, smoothstep(-w, w, diffuse - 0.3)));
    gl_FragColor = mix(EdgeColor, mCol, edge);
}
`;


const finalShader = {
    uniforms: {
        tDiffuse: { type: 't', value: null},
        iTime: { type: 'f', value: 0.0},
        tNoise: { type: 't', value: new THREE.TextureLoader().load('noise.png')}
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT_FINAL
};

const passFinal = new THREE.ShaderPass(finalShader);
passFinal.renderToScreen = true;
passFinal.material.extensions.derivatives = true;
composer.addPass(passFinal);


const resize = (width, height) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    composer.setSize(width, height);
    shadowBuffer.setSize(width, height);

    pass.uniforms.iResolution.value.set(width, height);

    renderer.setSize(width, height);
};


const render = () => {
    const tmpHeight = container.clientHeight;
    const tmpWidth = container.clientWidth;
    if (tmpHeight !== height || tmpWidth !== width) {
        height = tmpHeight;
        width = tmpWidth;
        resize(width, height);
    }

    controls.update();
    floor.material = matShadow;
    sphere.material = matShadow;
    renderer.render(scene, camera, shadowBuffer);
    pass.uniforms.tShadow.value = shadowBuffer.texture;

    floor.material = matNormal;
    sphere.material = matNormal;

    const ellapsed = clock.getElapsedTime();
    passFinal.uniforms.iTime.value = ellapsed;

    composer.render();

    requestAnimationFrame(render);
};



container.appendChild(canvas);
resize(width, height);
render();
