import dotenv from 'dotenv';
import pg from 'pg';
import EncryptionService from '../../apps/server/src/services/infrastructure/EncryptionService.js';
dotenv.config({quiet:true});
const pool=new pg.Pool(process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:process.env.DB_PORT});
try{
const result=await pool.query("SELECT canvas_sub, expires_at, access_token, refresh_token FROM canvas_user_tokens");
const metadata=result.rows.map(r=>{
 const fmt=v=>!v?'missing':/^([a-f0-9]{24}):([a-f0-9]{32}):([a-f0-9]+)$/i.test(v)?'aes-gcm-format':'unrecognized-format';
 return {identity:r.canvas_sub,expired:r.expires_at?new Date(r.expires_at)<new Date():null,accessFormat:fmt(r.access_token),refreshFormat:fmt(r.refresh_token),accessDecryptable:!!EncryptionService.safeDecrypt(r.access_token,'audit',true),refreshDecryptable:!!EncryptionService.safeDecrypt(r.refresh_token,'audit',true)};
});
console.log(JSON.stringify({count:metadata.length,records:metadata},null,2));
}finally{await pool.end()}
