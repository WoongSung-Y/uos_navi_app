require('dotenv').config(); // .env 파일에서 환경 변수 로드
const express = require('express'); // Express 서버 라이브러리
const multer = require('multer'); // 파일 업로드 라이브러리 (이미지, csv, pdf 등)
const { exec } = require('child_process'); // 외부 프로그램 실행 라이브러리
const cors = require('cors'); // CORS 설정 // 다른 도메인에서 API 호출 허용
const pool = require('./db'); // PostgreSQL DB 연결 설정

const app = express(); // Express 앱 생성

app.use(express.json());
app.use(cors({ origin: '*' }));

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/', // 파일 저장 폴더 지정정
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${file.fieldname}-${uniqueSuffix}.jpg`);
    },
  }),
});

// 루트 경로에 접속하면 HTML 응답
app.get('/', (req, res) => {
  res.send(`<h1>윤성웅 똥 멍청이</h1>
            <p>그냥 졸업이나 시켜주쇼.</p>`);
});

// Express 서버에서 /api/total_building 경로로 들어오는 get 요청 처리
// postgresql에 쿼리를 날려서 데이터를 가져온 후 json 형태로 반환
// building 테이블 데이터 조회
app.get('/api/total_building', async (req, res) => {
  console.log('요청된 total_building 데이터');
  try {
    const sql = `
      SELECT 
        id_0, 
        id,
        ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geom_json
      FROM building
      WHERE geom IS NOT NULL;
    `;
    const result = await pool.query(sql); // db에서 쿼리 실행 후
    console.log('쿼리 결과:', result.rows);
    res.json(result.rows); // 결과를 json 형태로 반환
  } catch (err) {
    console.error('DB 에러:', err);
    res.status(500).send('DB 에러');
  }
});

// 특정 건물의 특정 층에 대한 데이터 조회
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

// 노드 데이터 조회
app.get('/api/nodes', async (req, res) => {
  try {
    const sql = `
      SELECT node_id, ST_X(st_transform(geom,4326)) AS longitude, ST_Y(st_transform(geom,4326)) AS latitude, type
      FROM node;
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

// 최단경로 계산 쿼리
// 최단경로: pgr_dijkstra 함수 사용
// 출발 노드, 도착 노드 파라미터로 받아서 쿼리 실행
// 결과를 클라이언트에 반환
app.get('/api/shortest_path', async (req, res) => {
  const { startNode, endNode } = req.query;

  if (!startNode || !endNode) {
    return res.status(400).json({ error: '출발 노드, 도착 노드, 경로 타입이 필요합니다.' });
  }

  // 실내·실외 구분하여 링크 데이터 적용
  const query = `
  SELECT * FROM pgr_dijkstra(
    'SELECT id, node1::integer AS source, node2::integer AS target, length::double precision AS cost 
     FROM link', 
    $1::integer, $2::integer, false
  ) ORDER BY seq;
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



// 이미지 업로드 및 MATLAB 실행
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

// Edge 좌표 조회 API
// Edge ID 목록을 파라미터로 받아서 해당 Edge의 좌표 데이터를 반환
app.get('/api/edge_coordinates', async (req, res) => {
  const { edgeIds } = req.query;

  if (!edgeIds) {
    return res.status(400).json({ error: 'Edge ID 목록이 필요합니다.' });
  }
  // EdgeID 리스트 변환 (모든 요소 숫자로 변환, NaN 제거)
  const edgeIdArray = edgeIds.split(',').map(id => Number(id)).filter(id => !isNaN(id));

  if (edgeIdArray.length === 0) {
    return res.status(400).json({ error: '유효한 Edge ID가 없습니다.' });
  }
  // edgeIdArray에 포함된 Edge 조회
  const query = `
    SELECT id, ST_AsGeoJSON(st_transform(geom,4326)) as geom_json
    FROM link
    WHERE id = ANY($1) 
    ORDER BY ARRAY_POSITION($1, id); -- Edge ID 순서 유지
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

      // MultiLineString이면 `.flat()` 사용해서 1차원 배열로 변환
      const coordinates = geoJson.type === "MultiLineString"
        ? geoJson.coordinates.flat()
        : geoJson.coordinates;

      return {
        id: row.id,
        coordinates: coordinates
      };
    });

    console.log("✅ GeoJSON 기반 Edge 데이터 반환:", JSON.stringify(edges, null, 2));
    res.json(edges);
  } catch (err) {
    console.error("❌ Edge 좌표 조회 실패:", err);
    res.status(500).json({ error: "DB 에러 발생", details: err.message });
  }
});

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
