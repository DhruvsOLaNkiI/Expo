const fs = require('fs');
const { NodeIO } = require('@gltf-transform/core');

async function run() {
  const io = new NodeIO();
  const document = await io.read('./public/assets/3d model/Reception_Desk_1_fbx.glb');
  const root = document.getRoot();
  
  root.listMeshes().forEach(mesh => {
    console.log('Mesh:', mesh.getName());
    mesh.listPrimitives().forEach(prim => {
      const mat = prim.getMaterial();
      if (mat) {
        const factor = mat.getBaseColorFactor();
        console.log('  Material:', mat.getName(), 'BaseColor:', factor);
      }
    });
  });
}
run();
