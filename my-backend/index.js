require('dotenv').config();
const express = require('express');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;


// ① building_polygon 데이터를 GeoJSON 형태로 반환하는 라우트
app.get('/api/buildings', async (req, res) => {
  try {
    // PostGIS 함수 ST_AsGeoJSON 사용
    // "geom"이 Polygon인지, MultiPolygon인지에 따라 다르지만 기본 개념은 동일
    // id_0나 다른 칼럼을 함께 반환할 수 있음.
    const sql = `
    SELECT
        id_0,
        ST_AsGeoJSON(
        ST_Transform(geom, 4326)) as geom_json
        FROM building_polygon;
         `;

    const result = await pool.query(sql);
    // result.rows --> [ { id_0: number, geom_json: '{"type":"Polygon","coordinates":[...]}'} , ... ]

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('DB Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
