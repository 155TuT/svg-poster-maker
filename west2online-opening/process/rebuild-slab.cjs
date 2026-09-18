/* Reconstruct only the support cuboid from an orthonormal 3D rotation.
 * Default: write the geometry report / isolated drawing. --apply also replaces
 * connecting-plane in the editable SVG, preserving its screen-space centre.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const artFile = path.resolve(__dirname, '../2026-opening.svg');
const source = fs.readFileSync(artFile, 'utf8');
const number = v => Number(v.toFixed(6));
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const norm = v => Math.sqrt(dot(v, v));
const unit = v => v.map(n => n / norm(v));
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function tag(id) {
  const found = source.match(new RegExp('<(?:g|path)\\b[^>]*\\bid="' + id + '"[^>]*>'));
  if (!found) throw new Error('Missing SVG node: ' + id);
  return found[0];
}
function attr(markup, name) {
  return markup.match(new RegExp('\\b' + name + '="([^"]*)"'))?.[1];
}

// Read both independent directions from the actual bracket drawing.
const bracketTransform = attr(tag('code-sculpture'), 'transform');
if (!/^translate\([^)]*\) skewY\([^)]*\)$/.test(bracketTransform)) throw new Error('Bracket projection has changed; rederive its screen basis first.');
const rise = -Number(bracketTransform.match(/skewY\(([^)]+)\)/)[1]);
const side = attr(tag('right-upper-edge'), 'd').match(/[-+]?(?:\d*\.)?\d+/g).map(Number);
const dx = side[4] - side[2], dy = side[5] - side[3];
const a = Math.tan(rad(rise));
const b = (dy - a * dx) / dx;
if (!(a > 0 && b > 0 && a * b < 1)) throw new Error('No real orthographic rotation for these bracket directions.');

// Paper coordinates: X right, Y down, Z into the paper. View along +Z.
// First yaw X into the paper about Y; then pitch upward about screen X.
// Projection uses the first two coordinates of R = Rx(pitch) * Ry(yaw).
const yaw = Math.atan(Math.sqrt(a / b));
const pitch = Math.asin(Math.sqrt(a * b));
const cy = Math.cos(yaw), sy = Math.sin(yaw);
const cp = Math.cos(pitch), sp = Math.sin(pitch);
const R = [[cy, 0, -sy], [-sp * sy, cp, -sp * cy], [cp * sy, sp, cp * cy]];
const rotate = p => R.map(row => dot(row, p));
const transpose = R[0].map((_, i) => R.map(row => row[i]));
const orthogonalityError = Math.max(...transpose.flatMap((u, i) => transpose.map((v, j) => Math.abs(dot(u, v) - Number(i === j)))));
const determinant = R[0][0]*(R[1][1]*R[2][2]-R[1][2]*R[2][1]) - R[0][1]*(R[1][0]*R[2][2]-R[1][2]*R[2][0]) + R[0][2]*(R[1][0]*R[2][1]-R[1][1]*R[2][0]);
if (orthogonalityError > 1e-12 || Math.abs(determinant - 1) > 1e-12) throw new Error('Invalid rigid rotation');

// Preserve the previous projected length, width and height. World units differ
// because the old SVG numbers were sheared screen coordinates, not 3D lengths.
const dimensions = {length: 880 / cy, width: 136 / sy, height: 28 / cp};
const L = dimensions.length / 2, W = dimensions.width / 2, H = dimensions.height / 2;
const points3d = {
  A:[-L,-H,W], B:[L,-H,W], C:[L,-H,-W], D:[-L,-H,-W],
  E:[-L,H,W], F:[L,H,W], G:[L,H,-W], H:[-L,H,-W],
};
const points = Object.fromEntries(Object.entries(points3d).map(([key, p]) => [key, rotate(p)]));
const screenPoint = key => points[key].slice(0,2).map(number).join(' ');
const pathFor = keys => keys.map((key, i) => (i?'L':'M') + screenPoint(key)).join('') + 'Z';
const light = unit([-.5,-.8,-.6]);
const faces = [
  {id:'slab-left-face', name:'left', keys:['A','D','H','E'], normal:[-1,0,0], fill:'#EDCB95', opacity:.42},
  {id:'slab-long-face', name:'near', keys:['D','C','G','H'], normal:[0,0,-1], fill:'#CB9550', opacity:.35},
  {id:'slab-top', name:'top', keys:['A','B','C','D'], normal:[0,-1,0], fill:'#FFF0D1', opacity:.54},
];
for (const f of faces) {
  f.cameraNormal = rotate(f.normal);
  f.visible = f.cameraNormal[2] < 0;
  f.diffuse = Math.max(0, dot(f.cameraNormal, light));
  if (!f.visible) throw new Error('Attempt to draw a back-facing face: ' + f.name);
}
const allNormals = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(rotate);
if (allNormals.filter(n => n[2]<0).length !== 3) throw new Error('Expected exactly three visible faces');
const oldTransform = attr(tag('connecting-plane'), 'transform');
let center = [605, 1038 + 796 - a * 478];
if (/^translate\([^)]*\)$/.test(oldTransform)) center = oldTransform.match(/[-+]?(?:\d*\.)?\d+/g).map(Number);
const faceMarkup = faces.map(f => `    <path id="${f.id}" d="${pathFor(f.keys)}" fill="${f.fill}" fill-opacity="${f.opacity}" stroke="#B59564" stroke-opacity=".5" stroke-width="1.05"/>`).join('\n');
const edgeMarkup = `    <path id="slab-top-light" d="M${screenPoint('D')}L${screenPoint('A')}L${screenPoint('B')}" fill="none" stroke="#FFFBF1" stroke-opacity=".9" stroke-width="1.5"/>\n    <path id="slab-front-rim" d="M${screenPoint('D')}L${screenPoint('C')}" fill="none" stroke="#FFF7E6" stroke-opacity=".75" stroke-width="1.1"/>`;
const markup = `  <g id="connecting-plane" inkscape:groupmode="layer" inkscape:label="05 · 透明长方体（三维投影）" transform="translate(${center.map(number).join(' ')})" data-yaw-deg="${number(deg(yaw))}" data-pitch-deg="${number(deg(pitch))}">\n    <!-- X = length, Y = height, Z = width. Eight shared vertices; three front-facing planes. -->\n${faceMarkup}\n${edgeMarkup}\n  </g>`;

// Geometry-only proof drawing: no poster layers or crossing glass panes.
const proof = `<svg xmlns="http://www.w3.org/2000/svg" width="1206" height="720" viewBox="0 0 1206 720">
  <rect width="1206" height="720" fill="#F2EBDD"/>
  <g font-family="Inter,Segoe UI,Arial,sans-serif" fill="#424747">
    <text x="65" y="63" font-size="24" font-weight="700">ORTHOGRAPHIC CUBOID / EIGHT SHARED VERTICES</text>
    <text x="65" y="103" font-size="18">Yaw ${number(deg(yaw))} deg  /  Pitch ${number(deg(pitch))} deg  /  Screen rise ${rise} deg</text>
  </g>
  <g transform="translate(603 393)">${faceMarkup}${edgeMarkup}
    <g fill="#424747" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="15">${['A','B','C','D','H','G'].map(key=>`<circle cx="${number(points[key][0])}" cy="${number(points[key][1])}" r="3" fill="#A94D00"/><text x="${number(points[key][0]+8)}" y="${number(points[key][1]-8)}">${key}</text>`).join('')}</g>
  </g>
  <g font-family="Inter,Segoe UI,Arial,sans-serif" font-size="17" fill="#666A68">
    <text x="65" y="654">Top / near long face / left end face. One tone per plane; no centre highlight or hidden face overlay.</text>
    <text x="65" y="686">Screen centre and projected dimensions preserved. Translation remains independent of rotation.</text>
  </g>
</svg>\n`;
fs.writeFileSync(path.join(__dirname, 'slab-projection.svg'), proof);

const report = {
  coordinateSystem:{X:'length; right on paper',Y:'height; down on paper',Z:'width; into paper',view:'orthographic; camera looks along positive Z'},
  rotationOrder:'yaw about paper Y, then upward pitch about paper X; R = Rx * Ry',
  fittedTo:'code-sculpture/right-upper-edge from current SVG',
  observed:{screenRiseDegrees:rise,bracketUnprojectedDepth:[dx,dy],bracketScreenDepth:[dx,number(dy-a*dx)],depthScreenAngleDegrees:deg(Math.atan(b))},
  recoveredAngles:{yawDegrees:deg(yaw),pitchDegrees:deg(pitch)},rotation:R,
  dimensions,screenCenter:center,orthogonalityError,determinant,
  projectionAxes:transpose.map(v=>v.slice(0,2)),
  vertices:Object.fromEntries(Object.keys(points).map(k=>[k,{world:points3d[k],camera:points[k],screen:points[k].slice(0,2).map((n,i)=>n+center[i])}])),
  faces:faces.map(({id,keys,cameraNormal,visible,diffuse,fill,opacity})=>({id,keys,cameraNormal,visible,diffuse,fill,opacity})),
  removed:['non-visible right end face','hidden far lower edge','three-stop centre-hot light-ribbon gradient'],
  note:'Angles are the equivalent rigid 3D orientation fitted to the existing stylized bracket directions; the bracket itself remains untouched.',
};
if (process.argv.includes('--apply')) {
  let next = source.replace(/  <g id="connecting-plane"[\s\S]*?  <\/g>/, markup);
  next = next.replace(/    <linearGradient id="light-ribbon"[\s\S]*?    <\/linearGradient>\n/, '');
  next = next.replace(/  <!-- Support slab and brackets use exactly the same projection\.[^\n]* -->/, '  <!-- Cuboid regenerated from a rigid 3D rotation; see process/slab-geometry.json. -->');
  fs.writeFileSync(artFile, next);
  report.appliedSourceSha256 = hash(next);
}
fs.writeFileSync(path.join(__dirname, 'slab-geometry.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({yaw:deg(yaw),pitch:deg(pitch),dimensions,screenCenter:center,orthogonalityError,determinant,visibleFaces:faces.map(f=>f.name),applied:process.argv.includes('--apply')},null,2));
