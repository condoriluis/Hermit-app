/**
 * Las estadísticas de la página de venta (myhermit.vercel.app) y de las descargas, en la tabla `visitas`
 * (migración 0013). La landing avisa cada página vista con `POST /mide` (un `sendBeacon`, sin cookies ni
 * datos personales: el Worker guarda país y ciudad que dice Cloudflare, el sistema y si es móvil, y de dónde
 * se vino; la IP solo entra en el hash de `sesion`, que cambia cada día y no se puede deshacer). Cada descarga
 * real cuenta `/descargar` con su `?so=`.
 *
 * Leerlas es solo del creador: `GET /panel?llave=` es la página (se actualiza sola cada 30 s) y
 * `GET /estadisticas/datos?llave=` lo que consulta, con la llave `PUBLICAR`. Sin ella o con otra, 404.
 */
import { Env, Rechazo, cupo, iguales, json, type Sistema } from './index.ts'

/** Lo más que anota una misma sesión al día: una persona navega, no genera cientos de páginas. */
const VISITAS_AL_DIA = 300
/** Y una descarga: quien baja el instalador una vez no lo baja treinta. */
const DESCARGAS_AL_DIA = 30
/** Las filas de «En vivo» y de cada lista del panel. */
const EN_VIVO = 25
const LISTA = 15

interface Cf {
  country?: string
  city?: string
  region?: string
  timezone?: string
}

/** Lo que dice Cloudflare de la conexión (`request.cf`); fuera del Worker no está. */
const cfDe = (req: Request): Cf => (req as Request & { cf?: Cf }).cf ?? {}

const agente = (req: Request) => req.headers.get('user-agent') ?? ''

/** La sesión es la conexión y el día, resumidos: cuenta visitantes sin guardar su IP. */
async function sesion(req: Request): Promise<string> {
  const dia = new Date().toISOString().slice(0, 10)
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`hermit:${req.headers.get('cf-connecting-ip') ?? ''}:${agente(req)}:${dia}`))
  return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** El sistema en que navega quien visita, por su User-Agent. */
export function soDe(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows'
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  if (/mac os x|macintosh/i.test(ua)) return 'Mac'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Otro'
}

/** Si entra desde el teléfono o la tableta, o desde la computadora. */
export function dispDe(ua: string): string {
  return /mobi|android|iphone|ipad|ipod/i.test(ua) ? 'móvil' : 'escritorio'
}

const MOTORES = [
  ['google', 'Google'],
  ['bing', 'Bing'],
  ['duckduckgo', 'DuckDuckGo'],
  ['yahoo', 'Yahoo'],
  ['ecosia', 'Ecosia'],
  ['baidu', 'Baidu'],
  ['yandex', 'Yandex']
] as const
const REDES = [
  ['tiktok', 'TikTok'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
  ['youtu.be', 'YouTube'],
  ['whatsapp', 'WhatsApp'],
  ['telegram', 'Telegram'],
  ['t.me', 'Telegram'],
  ['reddit', 'Reddit'],
  ['twitter', 'X'],
  ['x.com', 'X'],
  ['linkedin', 'LinkedIn'],
  ['pinterest', 'Pinterest']
] as const
/** Si `host` es ese dominio o cuelga de él (`google.com.mx`, `m.youtube.com`), sin confundir `notgoogle.com`. */
const esDominio = (host: string, dominio: string) => host === dominio || host.startsWith(`${dominio}.`) || host.endsWith(`.${dominio}`) || host.includes(`.${dominio}.`)

/**
 * De dónde se vino, como dominio o nombre conocido: el `referer` se queda en su host (nada de la ruta ni del
 * correo). Sin él, `null` (directo o la página misma, que el panel enseña como «directo»/«la página»).
 */
export function refDe(cabecera: string | null): string | null {
  if (!cabecera) return null
  let host: string
  try {
    host = new URL(cabecera).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  if (!host || host === 'localhost' || host === '127.0.0.1') return null
  if (host === 'myhermit.vercel.app') return 'la página'
  for (const [d, n] of [...MOTORES, ...REDES]) if (esDominio(host, d)) return n
  return host.slice(0, 60)
}

/** Una fila de `visitas`, con lo que se sabe de la conexión. */
async function anotar(req: Request, env: Env, ses: string, tipo: 'pagina' | 'descarga', ruta: string | null, so: string | null): Promise<void> {
  const cf = cfDe(req)
  await env.DB.prepare('INSERT INTO visitas (ts, sesion, tipo, ruta, ref, pais, ciudad, so, disp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(new Date().toISOString(), ses, tipo, ruta, refDe(req.headers.get('referer')), cf.country ?? null, cf.city ?? null, so, dispDe(agente(req)))
    .run()
}

/**
 * `POST /mide`: la página vista que avisa la landing (`{p: ruta}`). Nunca falla de cara a quien visita: aunque el
 * cuerpo no sea válido o se pase del cupo, contesta 204.
 */
export async function visita(req: Request, env: Env): Promise<Response> {
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const ruta = typeof c.p === 'string' && c.p.startsWith('/') ? c.p.slice(0, 120) : '/'
  const ses = await sesion(req)
  if (await cupo(env, ses, 'visitas', VISITAS_AL_DIA)) await anotar(req, env, ses, 'pagina', ruta, null).catch(() => {})
  return new Response(null, { status: 204 })
}

/**
 * Una descarga de verdad (la que sirve el binario, no el aviso de Mac ni una repetición por `Range`): la llama
 * `/descargar` con `ctx.waitUntil`, así que no retrasa la descarga ni la rompe si D1 falla.
 */
export async function descarga(req: Request, env: Env, so: Sistema): Promise<void> {
  const ses = await sesion(req)
  if (!(await cupo(env, ses, 'descargas', DESCARGAS_AL_DIA))) return
  await anotar(req, env, ses, 'descarga', null, so)
}

/** La llave `PUBLICAR` por `?llave=`: sin ella o con otra, como si la ruta no existiera. */
function delCreador(req: Request, env: Env, url: URL): boolean {
  const llave = url.searchParams.get('llave') ?? ''
  return !!env.PUBLICAR && iguales(llave, env.PUBLICAR)
}

/** `GET /panel?llave=`: las estadísticas en una página que se actualiza sola cada 30 s. */
export async function panel(req: Request, env: Env, url: URL): Promise<Response> {
  if (!delCreador(req, env, url)) throw new Rechazo(404, 'No existe')
  return new Response(pagina(), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } })
}

/** `GET /estadisticas/datos?llave=`: lo que el panel consulta para dibujarse y refrescarse. */
export async function datos(req: Request, env: Env, url: URL): Promise<Response> {
  if (!delCreador(req, env, url)) throw new Rechazo(404, 'No existe')
  const hoy = new Date().toISOString().slice(0, 10)
  const q = <T>(sql: string, ...binds: (string | number)[]) => env.DB.prepare(sql).bind(...binds).all<T>()
  const [totales, ultimos, paises, ciudades, horas, sistemas_, dispositivos, referentes, porSo] = await Promise.all([
    q<{ total: number; unicos: number; hoy: number; descargas: number }>(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT sesion) AS unicos,
              SUM(CASE WHEN substr(ts, 1, 10) = ? THEN 1 ELSE 0 END) AS hoy,
              SUM(CASE WHEN tipo = 'descarga' THEN 1 ELSE 0 END) AS descargas
       FROM visitas`, hoy),
    q<Vista>(`SELECT ts, tipo, ruta, pais, ciudad, ref, so, disp FROM visitas ORDER BY id DESC LIMIT ${EN_VIVO}`),
    q<Grupo>(`SELECT COALESCE(pais, '??') AS clave, COUNT(*) AS n, COUNT(DISTINCT sesion) AS u FROM visitas WHERE tipo = 'pagina' GROUP BY clave ORDER BY n DESC LIMIT ${LISTA}`),
    q<Ciudad>(`SELECT COALESCE(pais, '??') AS pais, COALESCE(ciudad, '??') AS ciudad, COUNT(*) AS n FROM visitas WHERE tipo = 'pagina' GROUP BY pais, ciudad ORDER BY n DESC LIMIT ${LISTA}`),
    q<{ h: number; n: number }>(`SELECT CAST(strftime('%H', ts) AS INTEGER) AS h, COUNT(*) AS n FROM visitas WHERE tipo = 'pagina' GROUP BY h`),
    q<Grupo>(`SELECT COALESCE(so, '??') AS clave, COUNT(*) AS n FROM visitas WHERE tipo = 'pagina' GROUP BY clave ORDER BY n DESC`),
    q<Grupo>(`SELECT COALESCE(disp, '??') AS clave, COUNT(*) AS n FROM visitas WHERE tipo = 'pagina' GROUP BY clave ORDER BY n DESC`),
    q<Grupo>(`SELECT COALESCE(ref, 'directo') AS clave, COUNT(*) AS n FROM visitas WHERE tipo = 'pagina' GROUP BY clave ORDER BY n DESC LIMIT ${LISTA}`),
    q<Grupo>(`SELECT COALESCE(so, '??') AS clave, COUNT(*) AS n, COUNT(DISTINCT sesion) AS u FROM visitas WHERE tipo = 'descarga' GROUP BY clave ORDER BY n DESC`)
  ])
  const horas24 = Array.from({ length: 24 }, (_, h) => horas.results.find((r) => r.h === h)?.n ?? 0)
  return json({
    ahora: new Date().toISOString(),
    total: totales.results[0]?.total ?? 0,
    unicos: totales.results[0]?.unicos ?? 0,
    hoy: totales.results[0]?.hoy ?? 0,
    descargas: totales.results[0]?.descargas ?? 0,
    ultimos: ultimos.results,
    paises: paises.results,
    ciudades: ciudades.results,
    horas: horas24,
    sistemas: sistemas_.results,
    dispositivos: dispositivos.results,
    referentes: referentes.results,
    descargasPorSo: porSo.results
  })
}

interface Grupo {
  clave: string
  n: number
  u?: number
}
interface Ciudad {
  pais: string
  ciudad: string
  n: number
}
interface Vista {
  ts: string
  tipo: string
  ruta: string | null
  pais: string | null
  ciudad: string | null
  ref: string | null
  so: string | null
  disp: string | null
}

/** Nombres de los países que más llegan, para leer el panel sin buscar códigos ISO. */
const PAISES: Record<string, string> = {
  BO: 'Bolivia', MX: 'México', CO: 'Colombia', AR: 'Argentina', CL: 'Chile', PE: 'Perú', VE: 'Venezuela', EC: 'Ecuador',
  PY: 'Paraguay', UY: 'Uruguay', CR: 'Costa Rica', PA: 'Panamá', DO: 'Rep. Dominicana', GT: 'Guatemala', HN: 'Honduras',
  SV: 'El Salvador', NI: 'Nicaragua', CU: 'Cuba', PR: 'Puerto Rico', ES: 'España', US: 'Estados Unidos',
  BR: 'Brasil', PT: 'Portugal', DE: 'Alemania', FR: 'Francia', IT: 'Italia', GB: 'Reino Unido', NL: 'Países Bajos',
  CA: 'Canadá', IN: 'India', CN: 'China', JP: 'Japón', KR: 'Corea del Sur', AU: 'Australia'
}

/**
 * La página del panel: HTML+CSS+JS de un solo archivo, con la paleta de Hermit y barras en CSS puro. Pide
 * `/estadisticas/datos` cada 30 s y se dibuja sola; todo texto entra por `textContent`, sin HTML de fuera.
 */
function pagina(): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Hermit · Estadísticas</title>
<style>
:root{--fondo:#0b0e11;--tarjeta:#12161b;--borde:#232a33;--texto:#e8edf2;--suave:#8b97a5;--acento:#2dd4bf;--acento-suave:#5eead4}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);font:15px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:20px;margin:0}h2{font-size:13px;margin:0 0 12px;color:var(--suave);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.cab{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.cab small{color:var(--suave)}
.tarjetas{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.tarjeta{background:var(--tarjeta);border:1px solid var(--borde);border-radius:12px;padding:16px}
.tarjeta b{display:block;font-size:26px;font-weight:800}
.tarjeta span{color:var(--suave);font-size:13px}
.rejilla{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.caja{background:var(--tarjeta);border:1px solid var(--borde);border-radius:12px;padding:16px;min-width:0}
.caja.ancha{grid-column:1/-1}
table{width:100%;border-collapse:collapse;font-size:14px}
td,th{padding:7px 8px;text-align:left;border-bottom:1px solid var(--borde);white-space:nowrap}
th{color:var(--suave);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
td:last-child,th:last-child{text-align:right}
tr:last-child td{border-bottom:0}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--suave)}
.punto{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:var(--acento)}
.barra{display:grid;grid-template-columns:minmax(90px,1.2fr) 2fr auto;gap:10px;align-items:center;padding:4px 0;font-size:13px}
.pista{height:8px;background:var(--borde);border-radius:4px;overflow:hidden}
.pista i{display:block;height:100%;background:linear-gradient(90deg,var(--acento),var(--acento-suave));border-radius:4px}
.barra b{text-align:right;font-variant-numeric:tabular-nums}
.horas{display:flex;gap:3px;align-items:flex-end;height:110px;padding-top:8px}
.horas div{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end;min-width:0}
.horas i{display:block;width:100%;max-width:22px;background:var(--acento);border-radius:3px 3px 0 0;opacity:.85}
.horas span{font-size:10px;color:var(--suave)}
.vacio{color:var(--suave);font-size:14px;padding:12px 0}
#error{display:none;background:#3a1d1d;border:1px solid #7a3535;color:#f3b8b8;border-radius:10px;padding:12px;margin-bottom:16px;font-size:14px}
@media(max-width:640px){.barra{grid-template-columns:1fr auto}.pista{grid-column:1/-1;order:3}.horas span{display:none}}
</style></head><body><main>
<div id="error">No se pudieron leer las estadísticas. Si es la primera vez, aplica la migración 0013 y despliega el Worker.</div>
<div class="cab"><h1>Hermit · Estadísticas</h1><small id="actualizado"></small></div>
<div class="tarjetas" id="tarjetas"></div>
<div class="rejilla">
  <section class="caja ancha"><h2>En vivo</h2><div id="vivo"></div></section>
  <section class="caja"><h2>Países</h2><div id="paises"></div></section>
  <section class="caja"><h2>Ciudades</h2><div id="ciudades"></div></section>
  <section class="caja ancha"><h2>Visitas por hora (UTC)</h2><div class="horas" id="horas"></div></section>
  <section class="caja"><h2>Sistema</h2><div id="sistemas"></div></section>
  <section class="caja"><h2>Dispositivo</h2><div id="dispositivos"></div></section>
  <section class="caja"><h2>De dónde vienen</h2><div id="referentes"></div></section>
  <section class="caja"><h2>Descargas por sistema</h2><div id="descargas"></div></section>
</div>
</main>
<script>
const PAISES=${JSON.stringify(PAISES)};
const $=id=>document.getElementById(id);
const num=n=>Number(n||0).toLocaleString('es');
const esc=s=>String(s??'').slice(0,80);
function pais(c){return c==='??'?'—':(PAISES[c]||c)}
function barras(el,filas,{etiqueta=f=>f.clave}={}){
  if(!filas.length){el.innerHTML='<div class="vacio">Todavía no hay datos.</div>';return}
  const tope=Math.max(...filas.map(f=>Number(f.n)||0),1);
  el.innerHTML=filas.map(f=>'<div class="barra"><span>'+esc(etiqueta(f))+'</span><span class="pista"><i style="width:'+Math.round(Number(f.n)/tope*100)+'%"></i></span><b>'+num(f.n)+'</b></div>').join('');
}
function tabla(el,head,filas){
  if(!filas.length){el.innerHTML='<div class="vacio">Todavía no hay datos.</div>';return}
  el.innerHTML='<table><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr>'+filas.map(f=>'<tr>'+f.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</table>';
}
const hora=t=>new Date(t).toLocaleString('es',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const NOMBRES_SO={windows:'Windows',mac:'Mac Intel','mac-arm64':'Mac Apple Silicon',linux:'Linux'};
async function cargar(){
  try{
    const r=await fetch('/estadisticas/datos?llave='+encodeURIComponent(new URLSearchParams(location.search).get('llave')||''));
    if(!r.ok)throw 0;
    const d=await r.json();
    $('error').style.display='none';
    $('actualizado').textContent='Actualizado '+new Date(d.ahora).toLocaleTimeString('es')+' · cada 30 s';
    $('tarjetas').innerHTML=[['Visitas',d.total],['Personas únicas',d.unicos],['Hoy',d.hoy],['Descargas',d.descargas]].map(([t,v])=>'<div class="tarjeta"><b>'+num(v)+'</b><span>'+t+'</span></div>').join('');
    tabla($('vivo'),['Hora','Qué','Dónde','Detalle'],d.ultimos.map(v=>[
      '<span class="mono">'+hora(v.ts)+'</span>',
      v.tipo==='descarga'?'<span class="punto"></span>Descarga '+esc(NOMBRES_SO[v.so]||v.so||''):'<span class="punto"></span>Página',
      esc([pais(v.pais),v.ciudad!=='??'?v.ciudad:null].filter(Boolean).join(', ')||'—'),
      '<span class="mono">'+esc(v.ruta||(v.so?v.so:'')||'')+'</span>'
    ]));
    barras($('paises'),d.paises,{etiqueta:f=>pais(f.clave)});
    barras($('ciudades'),d.ciudades,{etiqueta:f=>pais(f.pais)+', '+f.ciudad});
    const max=Math.max(...d.horas,1);
    $('horas').innerHTML=d.horas.map((n,h)=>'<div title="'+h+':00 · '+num(n)+'"><i style="height:'+Math.max(2,Math.round(n/max*100))+'%"></i><span>'+(h%3===0?h:'')+'</span></div>').join('');
    barras($('sistemas'),d.sistemas);
    barras($('dispositivos'),d.dispositivos);
    barras($('referentes'),d.referentes);
    barras($('descargas'),d.descargasPorSo,{etiqueta:f=>NOMBRES_SO[f.clave]||f.clave});
  }catch(e){$('error').style.display='block'}
}
cargar();setInterval(cargar,30000);
</script></body></html>`
}
