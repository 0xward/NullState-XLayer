/* ============================================================
   NULL_STATE :: DUNGEON  (ancient underground complex generator)
   tile: 0=wall/rock 1=floor 2=stairs-down 3=door
   ------------------------------------------------------------
   Ancient-ruin layout — rooms are no longer only boxy chambers:
   - 'rect'  : hewn stone chambers (the classic squarish rooms)
   - 'cave'  : organic grottos carved with noise — natural caverns
               reached through their own corridor, so a hallway can
               visibly lead into a rough underground cave
   - 'cells' : an old underground prison block — the chamber's top
               strip is split into small barred cells with broken
               gate openings (recorded in room.gates for rendering)
   Every room also gets a `vibe` (stone / moss / earth / crypt /
   prison / cave) that the renderer uses to give each chamber its
   own ancient atmosphere: different floor gradation, rough or
   earthen wall texture, and era-appropriate décor.
   Connectivity is still validated with a flood fill from the
   start chamber; any failed layout regenerates from scratch.
   ============================================================ */
const TILE = 40; // world units per tile

// deterministic hash (stable results — no Math.random in carve noise, so a
// room's organic outline never depends on call order)
function dgHash(x,y){ let h=(x*374761393 + y*668265263)|0; h=Math.imul(h^(h>>>13),1274126177); return (h^(h>>>16))>>>0; }

// Organic grotto: keep tiles whose noisy radial distance falls inside the
// rim, force a cross through the center (so every door can reach it), then
// flood-fill from the center and re-seal any isolated pockets — guarantees
// the cave is one connected space with zero unreachable cells.
function carveCave(g,r,W){
  for(let y=r.y; y<r.y+r.h; y++)for(let x=r.x; x<r.x+r.w; x++){
    const nx=(x-r.cx)/(r.w*0.55), ny=(y-r.cy)/(r.h*0.55);
    const n=(dgHash(x*3+r.id*17, y*3)%1000)/1000;
    g[y][x] = (nx*nx + ny*ny + (n-0.5)*0.65 < 0.95) ? 1 : 0;
  }
  for(let x=r.x; x<r.x+r.w; x++) g[r.cy][x]=1;
  for(let y=r.y; y<r.y+r.h; y++) g[y][r.cx]=1;
  const keep=new Set(); const st=[[r.cx,r.cy]];
  while(st.length){
    const [x,y]=st.pop(); const k=y*W+x;
    if(x<r.x||y<r.y||x>=r.x+r.w||y>=r.y+r.h||keep.has(k)||g[y][x]!==1) continue;
    keep.add(k); st.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  for(let y=r.y; y<r.y+r.h; y++)for(let x=r.x; x<r.x+r.w; x++){
    if(g[y][x]===1 && !keep.has(y*W+x)) g[y][x]=0;
  }
}

// Ancient prison block: the top strip (2 tiles deep) becomes barred cells —
// a full cell-front wall with one broken-gate opening per cell, and stone
// partitions between neighbouring cells. The room's center column is always
// forced open so a north door can never be walled off, and every cell is
// guaranteed an opening (nothing can spawn or hide fully sealed away).
function carveCells(g,r){
  const wallY=r.y+2;
  r.gates=[];
  for(let x=r.x; x<r.x+r.w; x++) g[wallY][x]=0;              // cell-front wall
  for(let px=r.x+2; px<r.x+r.w-1; px+=3){                     // partitions
    g[r.y][px]=0; g[r.y+1][px]=0;
  }
  for(let sx=r.x; sx<r.x+r.w; sx+=3){                         // broken gates
    const gx=Math.min(sx+(dgHash(sx,r.id)%2), r.x+r.w-1);
    if(g[r.y][gx]!==0){ g[wallY][gx]=1; r.gates.push({x:gx,y:wallY}); }
  }
  g[r.y][r.cx]=1; g[r.y+1][r.cx]=1; g[wallY][r.cx]=1;         // north-door route
}

// How much bigger a floor gets per bunker (GAME-DESIGN.md §7, the TIME axis).
//
// MEASURED BEFORE THIS EXISTED: all five bunkers were the same floor, to within
// noise. `npm run measure:acts` put bunker 5 at 1.00x the walkable area of
// bunker 1, 0.95x the rooms and 0.93x the ENEMIES — the last bunker was very
// slightly emptier than the first. Size depended only on `depth`, which runs
// 1-5 inside every bunker, so the act never entered the arithmetic at all.
//
// That left "which bunker should I raid?" with no answer but the theme, and §7
// names the axis it should have: time vs risk. Risk is the act hard-mode curve
// in monster-config.js. This is time — later bunkers are physically longer to
// walk, which also means more rooms, and rooms are what carry enemies and
// containers, so effort and reward scale together without a second knob.
//
// Kept modest on purpose. MEASURED AFTER: bunker 5 is ~1.65x the walkable area
// of bunker 1, with ~1.55x the enemies and ~1.5x the rooms. A MiniPay session is
// 3-10 minutes on a mid-range phone, so bunker 1 stays the short option — which
// is the whole point of an axis rather than a global difficulty bump.
const ACT_SIZE = { w: 3, h: 2, rooms: 1 };

function tryMakeDungeon(depth, act){
  const a = Math.max(0, Math.min(4, act | 0));
  const W = 42 + Math.min(depth*2, 22) + a*ACT_SIZE.w;
  const H = 32 + Math.min(depth*2, 16) + a*ACT_SIZE.h;
  const g = Array.from({length:H},()=>new Array(W).fill(0));
  const rooms = [];
  const target = 6 + Math.min(depth, 7) + a*ACT_SIZE.rooms;
  let tries = 0;

  const tryPlace=(rw,rh)=>{
    const rx = 2 + (Math.random()*(W-rw-4)|0);
    const ry = 2 + (Math.random()*(H-rh-4)|0);
    for(const o of rooms){
      // 3-tile buffer so a real 2-tile-thick wall has room to render
      // between adjacent rooms instead of the wall ring overlapping
      // straight into a neighboring room.
      if(rx-3 < o.x+o.w+3 && rx+rw+3 > o.x-3 && ry-3 < o.y+o.h+3 && ry+rh+3 > o.y-3) return false;
    }
    const r = { x:rx, y:ry, w:rw, h:rh, cx:(rx+rw/2)|0, cy:(ry+rh/2)|0, id:rooms.length, visited:false, doors:[] };
    rooms.push(r);
    for(let y=ry; y<ry+rh; y++) for(let x=rx; x<rx+rw; x++) g[y][x]=1;
    return true;
  };
  while(rooms.length < target && tries < 500){
    tries++;
    // Fase 4 (user decision, revised): rooms stay BOXY rectangles — the
    // organic/curved-room plan was dropped. Same room count as before;
    // variety now comes from SIZE instead of shape: ~1/3 of placements try
    // a LARGE hall (9-13 tiles), the rest stay medium (5-8).
    const big = Math.random() < 0.35;
    tryPlace(big ? 9 + (Math.random()*5|0) : 5 + (Math.random()*4|0),   // 9-13 / 5-8
             big ? 8 + (Math.random()*4|0) : 5 + (Math.random()*4|0));  // 8-11 / 5-8
  }
  // Top-up pass: large halls burn a lot of failed placements on the small
  // shallow-depth maps, which used to leave floors under the target room
  // count. Fill the remainder with medium rooms only, so the room count per
  // floor stays exactly as before while big halls appear when space allows.
  tries=0;
  while(rooms.length < target && tries < 400){
    tries++;
    tryPlace(5 + (Math.random()*4|0), 5 + (Math.random()*4|0));
  }
  if(rooms.length < 3) return null; // too sparse, retry generation entirely

  // ---- room shapes & vibes ----
  // Fase 4 (user decision, revised): NO organic 'cave' rooms — every room is
  // boxy ('rect', plus the one boxy prison 'cells' block). carveCave() is
  // kept in the file but is no longer assigned. Vibes still rotate so each
  // chamber keeps its own ancient floor character.
  const vibePool=['stone','moss','earth','crypt'];
  for(let i=vibePool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=vibePool[i]; vibePool[i]=vibePool[j]; vibePool[j]=t; }
  let cellsDone=false, vi=0;
  for(let i=0;i<rooms.length;i++){
    const r=rooms[i];
    r.gates=null;
    if(i===0){ r.shape='rect'; r.vibe='stone'; continue; }                    // start chamber stays open
    if(i===rooms.length-1){ r.shape='rect'; r.vibe='crypt'; continue; }       // stairs chamber
    if(!cellsDone && r.w>=7 && r.h>=6){ r.shape='cells'; r.vibe='prison'; cellsDone=true; continue; }
    r.shape='rect'; r.vibe=vibePool[vi++ % vibePool.length];
  }
  for(const r of rooms){
    if(r.shape==='cave') carveCave(g,r,W);
    else if(r.shape==='cells') carveCells(g,r);
  }

  const doors = [];
  const inBounds=(x,y)=> x>=0&&y>=0&&x<W&&y<H;

  // Straight 1-tile corridor between two points that are already aligned
  // on one axis (caller guarantees this — see connect()). Carves through
  // ANY tile in the way (including other rooms' walls) so connectivity is
  // guaranteed; the post-generation flood-fill check catches the rare case
  // where this still isn't enough and triggers a full regeneration instead
  // of trying to patch it.
  function carveStraight(ax,ay,bx,by){
    let x=ax,y=ay;
    while(true){
      if(inBounds(x,y) && g[y][x]===0) g[y][x]=1;
      if(x===bx && y===by) break;
      x += Math.sign(bx-x);
      y += Math.sign(by-y);
    }
  }

  // Pick a door point on room's wall ring, on the side facing (tx,ty),
  // and the corridor-start tile just outside that door. Cave rooms keep a
  // guaranteed floor cross through (cx,cy), and cell blocks keep a forced
  // route down their center column, so every door always reaches the room.
  function doorTowards(room, tx, ty){
    const dx = tx-room.cx, dy = ty-room.cy;
    let dpx, dpy, outx, outy, side;
    if(Math.abs(dx) >= Math.abs(dy)){
      if(dx>=0){ dpx=room.x+room.w; outx=dpx+1; side='E'; } else { dpx=room.x-1; outx=dpx-1; side='W'; }
      dpy = Math.max(room.y+1, Math.min(room.y+room.h-2, room.cy));
      outy = dpy;
    } else {
      if(dy>=0){ dpy=room.y+room.h; outy=dpy+1; side='S'; } else { dpy=room.y-1; outy=dpy-1; side='N'; }
      dpx = Math.max(room.x+1, Math.min(room.x+room.w-2, room.cx));
      outx = dpx;
    }
    return { doorX:dpx, doorY:dpy, outX:outx, outY:outy, side };
  }

  function connect(roomA, roomB){
    const dA = doorTowards(roomA, roomB.cx, roomB.cy);
    const dB = doorTowards(roomB, roomA.cx, roomA.cy);
    if(!inBounds(dA.doorX,dA.doorY) || !inBounds(dB.doorX,dB.doorY)) return;
    g[dA.doorY][dA.doorX]=3;
    g[dB.doorY][dB.doorX]=3;
    roomA.doors.push({x:dA.doorX,y:dA.doorY,side:dA.side});
    roomB.doors.push({x:dB.doorX,y:dB.doorY,side:dB.side});
    doors.push({x:dA.doorX,y:dA.doorY,side:dA.side,roomA:roomA.id,roomB:roomB.id});
    doors.push({x:dB.doorX,y:dB.doorY,side:dB.side,roomA:roomA.id,roomB:roomB.id});
    // corridor: go from just-outside-A, axis-align, then to just-outside-B
    let cx=dA.outX, cy=dA.outY;
    if(inBounds(cx,cy) && g[cy][cx]===0) g[cy][cx]=1;
    // move to share one coordinate with B's outside point, then straight in
    if(cx===dB.outX || cy===dB.outY){
      carveStraight(cx,cy, dB.outX,dB.outY);
    } else {
      // bend once: travel along the axis the door faces first
      const midX = (dA.outX!==dA.doorX) ? cx : dB.outX; // if A's door faces E/W, keep A's x first
      const midY = (dA.outY!==dA.doorY) ? cy : dB.outY;
      carveStraight(cx,cy, midX,midY);
      carveStraight(midX,midY, dB.outX,dB.outY);
    }
    if(inBounds(dB.outX,dB.outY) && g[dB.outY][dB.outX]===0) g[dB.outY][dB.outX]=1;
  }

  for(let i=1;i<rooms.length;i++) connect(rooms[i-1], rooms[i]);

  const start = rooms[0];
  const last = rooms[rooms.length-1];
  g[last.cy][last.cx] = 2;
  start.visited = true;

  // connectivity check via flood fill from the start room's center
  const seen = Array.from({length:H},()=>new Array(W).fill(false));
  const stack=[[start.cx,start.cy]];
  while(stack.length){
    const [x,y]=stack.pop();
    if(!inBounds(x,y) || seen[y][x] || g[y][x]===0) continue;
    seen[y][x]=true;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  for(const r of rooms){ if(!seen[r.cy][r.cx]) return null; } // disconnected -> caller retries

  const spawns=[];
  for(let i=1;i<rooms.length;i++){
    const r=rooms[i];
    // pick REAL floor tiles: cave interiors are irregular, and prison-cell
    // interiors are excluded so enemies never spawn stuck behind the bars
    const tiles=[];
    const yFrom = (r.shape==='cells') ? r.y+3 : r.y;
    for(let ty=yFrom; ty<r.y+r.h; ty++)for(let tx=r.x; tx<r.x+r.w; tx++){
      if(g[ty][tx]===1) tiles.push([tx,ty]);
    }
    if(!tiles.length) continue;
    const n = 1 + Math.min((Math.random()*(1+depth/3))|0, 3);
    // Spawn points used to be picked independently, so nothing stopped two of
    // them landing on the same tile — and with up to four per room that was
    // common. A room would open with its whole crew standing inside each
    // other, and since they then chase the identical point at the identical
    // speed they never came apart. One swing hitting three stacked bodies is
    // what made kills feel unearned.
    //
    // Now each point has to clear the ones already placed. Twelve tries, and
    // if the room is too cramped to satisfy the gap we keep the most spread
    // candidate we saw rather than failing to spawn — a tight room SHOULD feel
    // tight, it just shouldn't stack bodies at one pixel.
    const MIN_GAP = TILE * 2.2;
    const placed = [];
    for(let k=0;k<n;k++){
      let best=null, bestD=-1;
      for(let t=0;t<12;t++){
        const [tx,ty]=tiles[(Math.random()*tiles.length)|0];
        const px=(tx+0.35+Math.random()*0.3)*TILE, py=(ty+0.35+Math.random()*0.3)*TILE;
        let d=Infinity;
        for(const s of placed){ const q=Math.hypot(px-s.x, py-s.y); if(q<d) d=q; }
        if(d>=MIN_GAP){ best={x:px,y:py}; break; }
        if(d>bestD){ bestD=d; best={x:px,y:py}; }
      }
      if(!best) continue;
      placed.push(best);
      spawns.push({ x:best.x, y:best.y, room:r.id });
    }
  }

  function roomAt(tx,ty){
    for(const r of rooms){
      if(tx>=r.x && tx<r.x+r.w && ty>=r.y && ty<r.y+r.h) return r;
    }
    return null;
  }
  const doorBySpot = {};
  for(const dr of doors) doorBySpot[dr.x+','+dr.y] = dr;
  function doorAt(tx,ty){ return doorBySpot[tx+','+ty] || null; }

  // Corridor connected components — every run of non-room floor/door tiles
  // (a "corridor") is grouped into its own component so we can (a) place
  // exactly two wall-mounted torches per corridor, evenly spread along its
  // length, and (b) reveal the whole corridor at once the moment the
  // player sets foot on any tile of it, instead of a narrow trailing patch.
  const isFloorT=(x,y)=> x>=0&&y>=0&&x<W&&y<H&&g[y][x]!==0;
  const corridorId = Array.from({length:H},()=>new Array(W).fill(-1));
  const corridorTiles = []; // corridorTiles[id] = ordered [x,y] list (BFS order ~= path order)
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(g[y][x]===0 || roomAt(x,y) || corridorId[y][x]!==-1) continue;
    const id = corridorTiles.length;
    const tiles=[]; const st=[[x,y]]; corridorId[y][x]=id;
    while(st.length){
      const [cx,cy]=st.pop(); tiles.push([cx,cy]);
      for(const [nx,ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){
        if(nx<0||ny<0||nx>=W||ny>=H||g[ny][nx]===0||roomAt(nx,ny)||corridorId[ny][nx]!==-1) continue;
        corridorId[ny][nx]=id; st.push([nx,ny]);
      }
    }
    corridorTiles.push(tiles);
  }

  // Wall torches: exactly two per corridor (roughly a third and two-thirds
  // along its tile order), each snapped onto whichever side is a real wall,
  // plus one over each room's top wall (only where that spot is actually
  // floor — cave rooms have irregular interiors). The renderer draws these
  // as warm, flickering flames mounted on the wall, not floating mid-path.
  const lamps=[];
  function wallSideAt(x,y){
    if(!isFloorT(x,y-1)) return 'N';
    if(!isFloorT(x-1,y)) return 'W';
    if(!isFloorT(x+1,y)) return 'E';
    // S (bottom wall) intentionally excluded — lamps only ever mount on
    // N/W/E walls per design direction, never on the wall facing the camera.
    return null;
  }
  for(const tiles of corridorTiles){
    if(tiles.length<3) continue; // too short for two separate sconces
    const idxs=[Math.floor(tiles.length*0.3), Math.floor(tiles.length*0.7)];
    for(const i of idxs){
      const [tx,ty]=tiles[i];
      const side=wallSideAt(tx,ty);
      if(!side) continue;
      lamps.push({tx,ty,side});
    }
  }
  for(const r of rooms){
    const lx=r.x+(r.w>>1);
    if(isFloorT(lx,r.y) && !isFloorT(lx,r.y-1)) lamps.push({tx:lx,ty:r.y,side:'N',room:r.id});
  }

  return {
    W,H,grid:g,rooms,doors,lamps,corridorId,
    startPx:{x:(start.cx+0.5)*TILE, y:(start.cy+0.5)*TILE},
    stairsPx:{x:(last.cx+0.5)*TILE, y:(last.cy+0.5)*TILE},
    spawns,
    isWall(px,py){
      const tx=(px/TILE)|0, ty=(py/TILE)|0;
      if(tx<0||ty<0||tx>=W||ty>=H) return true;
      return g[ty][tx]===0;
    },
    roomAt,
    doorAt,
    pxW:W*TILE, pxH:H*TILE,
  };
}

function makeDungeon(depth, act){
  for(let attempt=0; attempt<25; attempt++){
    const d = tryMakeDungeon(depth, act);
    if(d) return d;
  }
  // Extremely unlikely fallback: a single big safe room rather than
  // ever failing to produce a floor at all.
  const W=20,H=16;
  const g = Array.from({length:H},()=>new Array(W).fill(1));
  for(let x=0;x<W;x++){ g[0][x]=0; g[H-1][x]=0; }
  for(let y=0;y<H;y++){ g[y][0]=0; g[y][W-1]=0; }
  g[H-2][W-2]=2;
  const room={x:1,y:1,w:W-2,h:H-2,cx:(W/2)|0,cy:(H/2)|0,id:0,visited:true,doors:[],shape:'rect',vibe:'stone',gates:null};
  return {
    W,H,grid:g,rooms:[room],doors:[],lamps:[],corridorId:Array.from({length:H},()=>new Array(W).fill(-1)),
    startPx:{x:TILE*2,y:TILE*2}, stairsPx:{x:(W-2.5)*TILE,y:(H-2.5)*TILE},
    spawns:[{x:TILE*(W/2),y:TILE*(H/2)}],
    isWall(px,py){ const tx=(px/TILE)|0,ty=(py/TILE)|0; if(tx<0||ty<0||tx>=W||ty>=H) return true; return g[ty][tx]===0; },
    roomAt(){ return room; },
    doorAt(){ return null; },
    pxW:W*TILE, pxH:H*TILE,
  };
}
window.NS_DUNGEON={makeDungeon,TILE};
