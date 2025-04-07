require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pool = require('./db');
const path = require('path');
const app = express();
const fs = require('fs');
const { spawn } = require('child_process');

app.use(express.json());
app.use(cors({ origin: '*' }));

const upload = multer({
  storage: multer.diskStorage({
    destination: './View',
    filename: (req, file, cb) => {
      const originalName = req.body.filename || file.originalname;
      const filePath = path.join('./View', originalName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      cb(null, originalName);
    }
  })
});

// 🔁 큐 및 실행 상태
const indoorQueue = [];
let isProcessingIndoor = false;

function analyzeIndoorImage(filePath, pressure) {
  return new Promise((resolve, reject) => {
    const py = spawn('/usr/bin/python3', ['VPR.py', filePath, pressure.toString()], {
      cwd: path.resolve(__dirname)
    });
    let result = '', error = '';
    let didRespond = false;

    const timeout = setTimeout(() => {
      if (!didRespond) {
        py.kill('SIGTERM');
        reject('[⚠️ Timeout] Python script timed out');
      }
    }, 10000);

    py.stdout.on('data', data => {
      result += data.toString();
      console.log('[📃 PYTHON STDOUT]:', data.toString());
    });

    py.stderr.on('data', data => {
      error += data.toString();
      console.error('[🐍 PYTHON STDERR]:', data.toString());
    });
    py.on('error', err => {
      console.error('[🔥 PYTHON SPAWN ERROR]:', err); // 이게 중요함
    });
    // Python 프로세스 종료 시    
    py.on('close', code => {
      clearTimeout(timeout);
      fs.unlink(filePath, () => {});

      if (code !== 0 || error) return reject(error || `Python process exited with code ${code}`);
      const marker = '__RESULT__';
      const idx = result.indexOf(marker);
      if (idx === -1) return reject('[❌ RESULT 마커 없음]: ' + result);

      const jsonText = result.slice(idx + marker.length).trim();
      try {
        didRespond = true;
        resolve(JSON.parse(jsonText));
      } catch (e) {
        reject('[❌ JSON 파싱 에러]: ' + jsonText);
      }
    });
  });
}

// 🚦 하나씩 처리하는 큐 실행기
async function processIndoorImageQueue() {
  if (isProcessingIndoor || indoorQueue.length === 0) return;

  isProcessingIndoor = true;
  const { filePath, pressure, res } = indoorQueue.shift();

  try {
    const result = await analyzeIndoorImage(filePath, pressure);
    res.json({ message: '실내 위치 사진 수신 완료', result });
  } catch (err) {
    console.error('❌ 업로드 처리 오류:', err);
    res.status(500).json({ error: String(err) });
  } finally {
    isProcessingIndoor = false;
    processIndoorImageQueue(); // 다음 거 처리
  }
}

// 🛰️ 실내 이미지 업로드 (파일 저장 + 큐 처리)
app.post('/api/indoor_upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const filePath = req.file.path;
  const pressure = req.body.pressure ? parseFloat(req.body.pressure) : null;
  console.log(`📡 실내 위치 사진 수신: ${req.file.filename} (${req.file.size} bytes), 기압: ${pressure} hPa`);

  indoorQueue.push({ filePath, pressure, res });
  processIndoorImageQueue();
});

// 일반 이미지 업로드
app.post('/api/upload_image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload failed' });
  res.json({ message: 'Upload success', filePath: req.file.path });
});

app.use('/View', express.static(path.join(__dirname, 'View')));
app.use('/images', express.static(path.join(__dirname, 'View')));

app.get('/View_list', (req, res) => {
  const dir = path.join(__dirname, 'View');
  fs.readdir(dir, (err, files) => {
    if (err) return res.send('이미지 불러오기 실패');

    const images = files
      .filter(file => /\.(jpg|jpeg|png)$/i.test(file))
      .map(file => `<div><img src="/View/${file}" style="width:300px;margin:10px"/><p>${file}</p></div>`);

    res.send(`<h1>📷 업로드된 이미지</h1>${images.join('')}`);
  });
});



/**
 * 0. 서버 페이지 확인
 */

app.get('/', (req, res) => {
  res.send(`<h1> 레전드 탱탱볼!</h1>
            <p>승석이가 대굴대굴 굴러가고 있습니다 .</p>

            <h2> API 목록 </h2>
            <ul>
               <li><a href="/api/total_building">/api/total_building</a></li>
	       <li><a href="/api/nodes">/api/nodes</a></li>
               <li><a href="/api/all_edge?floor=1">/api/all_edge?floor=1</a></li>
	       <li><a href="/View_list">/View_list</a></li>
           </ul>


`); 
});



/**
 * 1. 건물 외곽 데이터 조회 API
 */
app.get('/api/total_building', async (req, res) => {
  console.log('요청된 total_building 데이터');

  try {
    const sql = `
      SELECT 
        id_0, 
        id,
        ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geom_json,
	build_name,
	min_floor,
	max_floor
      FROM building
      WHERE geom IS NOT NULL;
    `;
    const result = await pool.query(sql);
    console.log('쿼리 결과:', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('DB 에러:', err);
    res.status(500).send('DB 에러');
  }
});

/**
 * 2. 특정 층의 건물 내부 데이터 조회 API
 */
app.get('/api/buildings_in', async (req, res) => {
  const { floor, buildingId } = req.query;

  console.log('요청된 floor 값:', floor, '요청된 buildingId:', buildingId);

  try {
    if (!floor || isNaN(Number(floor)) || !buildingId || isNaN(Number(buildingId))) {
      return res.status(400).json({ error: '유효한 floor 값과 buildingId가 필요합니다.' });
    }

    const sql = `
      SELECT 
        id_0, 
        ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geom_json
      FROM building_in
      WHERE floor = $1 AND building_i = $2;
    `;

    const result = await pool.query(sql, [Number(floor), Number(buildingId)]);
    res.json(result.rows);
  } catch (err) {
    console.error('DB 에러:', err);
    res.status(500).send('DB 에러');
  }
});

/**
 * 3. 노드 데이터 조회 API (실내·실외 구분 포함)
 */
app.get('/api/nodes', async (req, res) => {
  try {
    const sql = `
      SELECT node_id, ST_X(st_transform(geom,4326)) AS longitude, ST_Y(st_transform(geom,4326)) AS latitude,
	     type , lect_num , transit , node_att , bulid_name , RealView, floor
      FROM node where node_att != 6 ;
    `;
    const result = await pool.query(sql);
    console.log("📡 DB에서 가져온 노드 데이터:", result.rows); // 디버깅 로그 추가

    if (result.rows.length === 0) {
      console.error("❌ [DB 문제] 노드 데이터가 없습니다.");
      return res.status(500).json({ error: "데이터 없음: nodes 테이블이 비어 있음" });
    }

    console.log("✅ 노드 데이터 조회 성공:", result.rows.length, "개");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ [DB 오류] 노드 데이터 조회 실패:", err);
    res.status(500).json({ error: "DB 에러 발생", details: err.message });
  }
});

/**
 * 4. 최단 경로 탐색 API (실내·실외 구분 적용)
 */
app.get('/api/shortest_path', async (req, res) => {
  const { startNode, endNode } = req.query;

  if (!startNode || !endNode) {
    return res.status(400).json({ error: '출발 노드, 도착 노드, 경로 타입이 필요합니다.' });
  }

  // 실내·실외 구분하여 링크 데이터 적용
  const query = `
  SELECT * FROM pgr_dijkstra(
    'SELECT L.id, L.node1::integer AS source, L.node2::integer AS target, L.length::double precision AS cost 
     FROM link as L
     JOIN node AS N1 ON L.node1 = N1.node_id
     JOIN node AS N2 ON L.node2 = N2.node_id
     WHERE N1.node_att != 6 and N2.node_att != 6', 
     $1::integer, $2::integer, false
  ) ORDER BY agg_cost;
`;

try {
  console.log("📝 실행할 SQL 쿼리:", query);
  console.log("📌 전달할 파라미터:", Number(startNode), Number(endNode));

  const result = await pool.query(query, [Number(startNode), Number(endNode)]);

  console.log("✅ 쿼리 결과:", result.rows);
  // 📌 결과를 클라이언트에 반환
  res.json(result.rows);

} catch (err) {
  console.error("❌ 쿼리 실행 오류:", err);
}})



/**
 * 5. 이미지 업로드 및 MATLAB 처리 API
 */
app.post('/api/upload', upload.single('image'), (req, res) => {
  const imagePath = req.file.path;
  const dataFilePath = process.env.MATLAB_DATA_PATH;
  const matlabPath = `"C:\\Program Files\\MATLAB\\R2024a\\bin\\matlab.exe"`;
  const matlabScriptPath = './matlab';

  console.log('MATLAB 처리할 이미지 경로:', imagePath);
  console.log('MATLAB 처리할 데이터 파일 경로:', dataFilePath);

  console.time('MATLAB Execution');
  exec(
    `${matlabPath} -batch "addpath('${matlabScriptPath}'); processImage('${imagePath}', '${dataFilePath}')"`,
    (err, stdout, stderr) => {
      console.timeEnd('MATLAB Execution');
      if (err) {
        console.error('MATLAB 실행 에러:', stderr);
        return res.status(500).json({ message: 'MATLAB 처리 실패', error: stderr });
      }

      console.log('MATLAB stdout:', stdout);

      try {
        const result = JSON.parse(stdout.trim());
        res.json(result);
      } catch (parseError) {
        console.error('MATLAB 결과 파싱 에러:', parseError);
        res.status(500).json({ message: 'MATLAB 결과 파싱 실패', error: parseError.message });
      }
    }
  );
});

/**
  * 6. 최단경로 edge 좌표 불러오기
**/
app.get('/api/edge_coordinates', async (req, res) => {
  const { edgeIds } = req.query;

  if (!edgeIds) {
    return res.status(400).json({ error: 'Edge ID 목록이 필요합니다.' });
  }

  const edgeIdArray = edgeIds.split(',').map(id => Number(id)).filter(id => !isNaN(id));

  if (edgeIdArray.length === 0) {
    return res.status(400).json({ error: '유효한 Edge ID가 없습니다.' });
  }

  const query = `
    SELECT id, ST_AsGeoJSON(st_transform(geom,4326)) as geom_json , floor, buildname
    FROM link
    WHERE id = ANY($1)
    ORDER BY ARRAY_POSITION($1, id); -- 🔥 Edge ID 순서 유지
  `;

  try {
    console.log("🛣️ 요청한 Edge ID 리스트:", edgeIdArray);
    const result = await pool.query(query, [edgeIdArray]);

    if (result.rows.length === 0) {
      console.warn("⚠️ 요청한 Edge 중에서 DB에 존재하는 Edge가 없습니다.");
      return res.json([]);
    }

    const edges = result.rows.map(row => {
      const geoJson = JSON.parse(row.geom_json);

      // 🔥 MultiLineString이면 `.flat()` 사용해서 1차원 배열로 변환
      const coordinates = geoJson.type === "MultiLineString"
        ? geoJson.coordinates.flat()
        : geoJson.coordinates;

      return {
        id: row.id,
        coordinates: coordinates,
	floor : row.floor,
	buildname : row.buildname
      };
    });

    console.log("✅ GeoJSON 기반 Edge 데이터 반환:", JSON.stringify(edges, null, 2));
    res.json(edges);
  } catch (err) {
    console.error("❌ Edge 좌표 조회 실패:", err);
    res.status(500).json({ error: "DB 에러 발생", details: err.message });
  }
});
/**
  * 7. 모든 edge 정보 나타내기
**/
app.get('/api/all_edge', async (req, res) => {
  const { floor } = req.query;
  let result;

  try {
    if (floor) {
      const query = `
        SELECT id,node1,node2, ST_AsGeoJSON(st_transform(geom, 4326)) as geom_json
        FROM link
        WHERE floor = $1
      `;
      result = await pool.query(query, [Number(floor)]);
    } else {
      const query = `
        SELECT id,node1,node2, ST_AsGeoJSON(st_transform(geom, 4326)) as geom_json
        FROM link
        WHERE type = 'outdoor'
      `;
      result = await pool.query(query);
    }

    const edges = result.rows.map(row => {
      const geoJson = JSON.parse(row.geom_json);
      const coordinates =
        geoJson.type === 'MultiLineString'
          ? geoJson.coordinates.flat()
          : geoJson.coordinates;

      return {
        id: row.id,
        coordinates,
	node1 : row.node1,
	node2 : row.node2
      };
    });

    res.json(edges);
  } catch (error) {
    console.error('🚨 모든 Edge 데이터 가져오기 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

/** 
  * 8. 경로에 맞는 이미지 뿌리기
**/
app.use('/images', express.static(path.join(__dirname, 'View')));


/**
 * 9. 서버 실행
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT,'0.0.0.0', () => {
});
