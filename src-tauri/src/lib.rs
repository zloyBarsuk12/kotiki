// Котик: каждое окно — один питомец (кот или щенок). Окно маленькое, прозрачное, поверх
// всех, без панели задач; его позицию каждый кадр задаёт страница (dist/pet.js) командой frame.
// Трей: позвать, покормить, поиграть, голос, спать, добавить кота/щенка, убрать, звук, автозапуск.
// Обновляется сам по адресу из tauri.conf.json (plugins.updater); адреса выпуска — в edition.rs.
mod edition;

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, RunEvent, State, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_updater::UpdaterExt as _;

const MAX_PETS: usize = 12;   // каждый питомец — своё окно WebView2 (~60 МБ), больше дюжины не стоит
const COLORS: usize = 16;   // верхняя граница номера окраса; сами списки — в dist/palettes.js
const SPECIES: [&str; 9] = ["cat", "dog", "hamster", "bird", "rabbit", "dragon", "kuzya", "clippy", "custom"];

#[derive(Serialize, Deserialize, Clone, PartialEq, Default)]
#[serde(default)]
struct Pet {
    sp: String,    // "cat" | "dog" | "hamster" | "bird"
    color: usize,  // номер окраса в dist/palettes.js
    build: String, // "normal" | "chubby"
    fur: String,   // свой цвет шерсти "#rrggbb" или пусто
    name: String,  // имя, которое дал владелец (пусто — имя окраса)
    sex: String,   // "m" | "f" | "" (по имени окраса) — для реплик
    character: String, // "playful" | "lazy" | "shy" | "brave" — выпадает при заведении
    born: String,  // дата заведения ГГГГ-ММ-ДД
    look: String,  // конструктор внешности: JSON {chest, paws, iris, nose, earIn, tail, marks…} или пусто
    #[serde(skip_deserializing)]
    label: String,
    #[serde(default)]
    guest: bool,   // чужой питомец в гостях: не сохраняется, уходит сам
    #[serde(default)]
    owner: String, // чьё имя показывать гостю
    #[serde(default)]
    dur: u64,      // сколько гостить, мс
    #[serde(default)]
    msg: String,   // гость-курьер: что передать на словах
}
impl Pet {
    fn new(sp: &str) -> Self {
        Pet { sp: sp.into(), build: "normal".into(), ..Default::default() }
    }
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
struct Bed {
    on: bool,
    x: i32,
    y: i32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
struct Cfg {
    sound: bool,
    pets: Vec<Pet>,
    bed: Bed,
    calendar: String,   // приватная ссылка .ics (Яндекс.Календарь → экспорт)
    caldav: CalDav,
    client_id: String,  // случайный постоянный id приложения для портала (гости)
    visits: bool,       // питомцы ходят в гости и принимают гостей
    tts: bool,          // озвучивать реплики системным голосом
    keys: bool,         // реагировать на Ctrl+S / Ctrl+Z (только две комбинации, по умолчанию выключено)
    #[serde(default)]
    guest: Option<GuestSaved>,   // гость, который сейчас у нас: чтобы пережил перезапуск (тихое обновление)
}
impl Default for Cfg {
    fn default() -> Self {
        Cfg { sound: true, pets: vec![Pet::new("cat")], bed: Bed::default(), calendar: String::new(), caldav: CalDav::default(), client_id: String::new(), visits: true, tts: false, keys: false, guest: None }
    }
}

#[derive(Serialize, Deserialize, Clone, Default)]
struct GuestSaved {
    pet: Pet,
    owner: String,
    until: u64,   // до какого момента гостит, мс с эпохи
}

fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Яндекс.Календарь по CalDAV: логин (почта) и пароль приложения (id.yandex.ru → Безопасность → Пароли приложений).
/// Пароль лежит в конфиге открытым текстом — это личный файл в профиле пользователя.
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
struct CalDav {
    user: String,
    pass: String,
}

struct AppState {
    cfg: Mutex<Cfg>,
    path: PathBuf,
    live: Mutex<Vec<Pet>>,  // открытые окна по порядку создания
}
impl AppState {
    fn save(&self) {
        let cfg = self.cfg.lock().unwrap().clone();
        if let Some(dir) = self.path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        let _ = fs::write(&self.path, serde_json::to_string_pretty(&cfg).unwrap_or_default());
    }
}

#[derive(Serialize)]
struct Frame {
    cx: f64,
    cy: f64,
    wx: i32,
    wy: i32,
    btn: bool,
}

#[cfg(windows)]
fn left_button() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
    unsafe { (GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000) != 0 }
}
#[cfg(not(windows))]
fn left_button() -> bool {
    false
}

/// Кадр: подвинуть окно, включить/выключить прозрачность для мыши, вернуть курсор.
#[tauri::command]
fn frame(window: WebviewWindow, x: Option<i32>, y: Option<i32>, ignore: Option<bool>) -> Frame {
    if let (Some(x), Some(y)) = (x, y) {
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
    if let Some(i) = ignore {
        let _ = window.set_ignore_cursor_events(i);
    }
    let c = window.cursor_position().unwrap_or_default();
    let p = window.outer_position().unwrap_or_default();
    Frame { cx: c.x, cy: c.y, wx: p.x, wy: p.y, btn: left_button() }
}

#[derive(Serialize)]
struct Mon {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
}
#[derive(Serialize)]
struct Screens {
    monitors: Vec<Mon>,
    sound: bool,
}

/// Рабочие области мониторов (без панели задач), основной — первым.
#[tauri::command]
fn screens(window: WebviewWindow, st: State<AppState>) -> Screens {
    let primary = window.primary_monitor().ok().flatten().map(|m| *m.position());
    let mut list = window.available_monitors().unwrap_or_default();
    list.sort_by_key(|m| Some(*m.position()) != primary);
    let monitors = list
        .iter()
        .map(|m| {
            let wa = m.work_area();
            Mon { x: wa.position.x, y: wa.position.y, w: wa.size.width, h: wa.size.height }
        })
        .collect();
    Screens { monitors, sound: st.cfg.lock().unwrap().sound }
}

async fn tokio_sleep(secs: u64) {
    // без прямой зависимости от tokio: спим в блокирующем потоке рантайма
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(std::time::Duration::from_secs(secs))).await;
}

fn today() -> String {
    // ГГГГ-ММ-ДД по локальному времени без зависимостей: достаточно дня с точностью до часового пояса UTC
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) as i64;
    let days = secs / 86400;
    // алгоритм civil_from_days (Howard Hinnant)
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{y:04}-{m:02}-{d:02}")
}

fn rand() -> u64 {
    let n = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(7);
    n.wrapping_mul(6364136223846793005).rotate_left(17)
}

/// Новый питомец. `restore` — из настроек (окрас и прочее как было), иначе первый свободный окрас вида.
// Окна создаём только из главного цикла событий или из async-команд: синхронная команда
// выполняется в главном потоке, и WebView2 на Windows ждёт его же — окно создаётся пустым
// и всё виснет (так было в 1.3.0 с правым кликом). Блокировку списка на время build не держим.
fn spawn_pet(app: &AppHandle, sp: &str, restore: Option<Pet>) -> tauri::Result<()> {
    let st = app.state::<AppState>();
    let mut live = st.live.lock().unwrap();
    if live.len() >= MAX_PETS {
        return Ok(());
    }
    let mut pet = restore.unwrap_or_else(|| {
        let mut p = Pet::new(sp);
        p.color = (0..COLORS).find(|c| !live.iter().any(|q| q.sp == sp && q.color == *c)).unwrap_or((rand() % COLORS as u64) as usize);
        p.look = "litter".into();   // страница сама разыграет вариации и сохранит их через pet_update
        p
    });
    if pet.character.is_empty() {
        pet.character = ["playful", "lazy", "shy", "brave"][(rand() % 4) as usize].to_string();
    }
    if pet.born.is_empty() {
        pet.born = today();
    }
    pet.color %= COLORS;
    if pet.build != "chubby" {
        pet.build = "normal".into();
    }
    let n = (1..).find(|i| !live.iter().any(|p| p.label == format!("pet{i}"))).unwrap_or(1);
    pet.label = format!("pet{n}");
    let label = pet.label.clone();
    let init = serde_json::to_string(&pet).unwrap_or_default();
    live.push(pet);                              // место занято — второй вызов не возьмёт ту же метку
    drop(live);
    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title(match sp { "dog" => "Щенок", "hamster" => "Хомячок", "bird" => "Попугай", "rabbit" => "Кролик", "dragon" => "Дракончик", "kuzya" => "Домовёнок", "clippy" => "Скрепка", "round" => "Круглыш", "custom" => "Свой", _ => "Котик" })
        .inner_size(220.0, 180.0)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(false)
        .focusable(false)
        .visible(false)
        .initialization_script(format!("window.PET = {init};"));
    // Голос без клика пользователя: иначе WebView2 не даст AudioContext звучать.
    // Первые три флага — те, что Tauri ставит по умолчанию (аргументы заменяют их целиком).
    #[cfg(windows)]
    let builder = builder.additional_browser_args(
        "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required",
    );
    let w = match builder.build() {
        Ok(w) => w,
        Err(e) => {
            st.live.lock().unwrap().retain(|p| p.label != label);
            return Err(e);
        }
    };
    if let Ok(Some(m)) = w.primary_monitor() {
        let wa = m.work_area();
        let s = m.scale_factor();
        let (ww, wh) = ((220.0 * s) as i32, (180.0 * s) as i32);
        let span = (wa.size.width as i32 - ww).max(1) as u64;
        let x = wa.position.x + (rand() % span) as i32;
        let y = wa.position.y + wa.size.height as i32 - wh;
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
    if let Some(nm) = st.live.lock().unwrap().iter().find(|p| p.label == label).map(|p| p.name.clone()).filter(|n| !n.is_empty()) {
        let _ = w.set_title(&nm);
    }
    w.show()?;
    let pets = st.live.lock().unwrap().clone();
    st.cfg.lock().unwrap().pets = pets;
    st.save();
    let _ = app.emit_to("settings", "pets-changed", ());
    Ok(())
}

/// Убрать питомца (по метке, иначе последнего). Последнего оставшегося не убираем.
fn remove_pet(app: &AppHandle, label: Option<&str>) {
    let st = app.state::<AppState>();
    let mut live = st.live.lock().unwrap();
    if live.len() <= 1 {
        return;
    }
    let idx = match label {
        Some(l) => live.iter().position(|p| p.label == l),
        None => Some(live.len() - 1),
    };
    if let Some(p) = idx.map(|i| live.remove(i)) {
        if let Some(w) = app.get_webview_window(&p.label) {
            let _ = w.destroy();
        }
    }
    let pets = live.clone();
    drop(live);
    st.cfg.lock().unwrap().pets = pets;
    st.save();
    let _ = app.emit_to("settings", "pets-changed", ());
}

// ---------- окно «Питомцы» ----------

#[tauri::command]
fn pets_list(st: State<AppState>) -> Vec<Pet> {
    st.live.lock().unwrap().clone()
}

/// Сменить окрас, свой цвет или телосложение — питомец перерисовывается сразу, без перезапуска.
#[tauri::command]
fn pet_update(app: AppHandle, label: String, color: usize, build: String, fur: String, name: Option<String>, sex: Option<String>, look: Option<String>) -> Result<(), String> {
    let st = app.state::<AppState>();
    let fur = if fur.len() == 7 && fur.starts_with('#') && fur[1..].chars().all(|c| c.is_ascii_hexdigit()) { fur } else { String::new() };
    let build = if build == "chubby" { build } else { "normal".into() };
    let name: String = name.unwrap_or_default().trim().chars().take(24).collect();
    let sex = match sex.as_deref() { Some("m") => "m", Some("f") => "f", _ => "" }.to_string();
    // у своего персонажа в look лежит картинка data-URL (сотни КБ) — обрезать нельзя, иначе он пропадёт после любой правки
    let look: String = look.unwrap_or_default().chars().take(1_500_000).collect();
    let look = if serde_json::from_str::<serde_json::Value>(&look).is_ok() { look } else { String::new() };
    let pets = {
        let mut live = st.live.lock().unwrap();
        let p = live.iter_mut().find(|p| p.label == label).ok_or("нет такого питомца")?;
        p.color = color % COLORS;
        p.build = build.clone();
        p.fur = fur.clone();
        p.name = name.clone();
        p.sex = sex.clone();
        p.look = look.clone();
        live.clone()
    };
    st.cfg.lock().unwrap().pets = pets;
    st.save();
    if let Some(w) = app.get_webview_window(&label) {
        if !name.is_empty() {
            let _ = w.set_title(&name);
        }
    }
    app.emit_to(label.as_str(), "pet-look", serde_json::json!({ "label": label, "color": color % COLORS, "build": build, "fur": fur, "name": name, "sex": sex, "look": look }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn pet_add(app: AppHandle, sp: String) -> Result<(), String> {
    let sp = SPECIES.iter().find(|s| **s == sp).copied().unwrap_or("cat");
    spawn_pet(&app, sp, None).map_err(|e| e.to_string())
}

/// Потомство: окно настроек прислало готового питомца (вид, окрас, цвет, внешность, имя).
#[tauri::command]
async fn pet_add_custom(app: AppHandle, pet: Pet) -> Result<(), String> {
    let sp = SPECIES.iter().find(|s| **s == pet.sp).copied().ok_or("нет такого вида")?;
    let mut p = pet;
    p.label = String::new();
    p.born = String::new();
    p.character = String::new();
    spawn_pet(&app, sp, Some(p)).map_err(|e| e.to_string())
}

#[tauri::command]
fn pet_remove(app: AppHandle, label: String) {
    remove_pet(&app, Some(&label));
}

const PROPS: [&str; 12] = ["ball", "laser", "butterfly", "bed", "yarn", "post", "bubbles", "nest", "mouse", "gift", "bowl", "poll"];

/// Предмет (мячик, лазер, бабочка, лежанка) — отдельное прозрачное окно; метка окна = вид.
/// Только из async-команды или главного цикла (см. spawn_pet).
#[tauri::command]
/// `data` — JSON для окна (подарок: что, от кого, подпись); в страницу уходит строкой в window.PROP.data.
async fn prop_show(app: AppHandle, kind: String, x: i32, y: i32, data: Option<String>) -> Result<(), String> {
    let kind = PROPS.iter().find(|k| **k == kind).copied().ok_or("нет такого предмета")?;
    if app.get_webview_window(kind).is_some() {
        return Ok(());
    }
    let w = WebviewWindowBuilder::new(&app, kind, WebviewUrl::App("prop.html".into()))
        .title(match kind { "laser" => "Лазер", "butterfly" => "Бабочка", "bed" => "Лежанка", "yarn" => "Клубок", "post" => "Когтеточка", "bubbles" => "Пузыри", "nest" => "Гнездо", "mouse" => "Мышь", "gift" => "Подарок", "bowl" => "Миска", "poll" => "Опрос", _ => "Мячик" })
        .inner_size(match kind { "bubbles" => 260.0, "post" => 140.0, "nest" => 180.0, "gift" => 300.0, "bed" => 190.0, "poll" => 280.0, _ => 120.0 }, match kind { "bubbles" => 520.0, "post" => 180.0, "gift" => 260.0, "bed" => 160.0, "poll" => 130.0, _ => 120.0 })
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(false)
        .focusable(false)
        .visible(false)
        .initialization_script(format!("window.PROP = {{ kind: \"{kind}\", x: {x}, y: {y}, data: {} }};", serde_json::to_string(&data.unwrap_or_default()).unwrap_or_else(|_| "\"\"".into())))
        .build()
        .map_err(|e| e.to_string())?;
    let _ = w.set_position(PhysicalPosition::new(x - 60, y - 60));
    let _ = w.show();
    Ok(())
}


#[tauri::command]
fn prop_hide(app: AppHandle, kind: String) {
    if let Some(w) = app.get_webview_window(&kind) {
        let _ = w.destroy();
    }
}

/// Кот «толкает» курсор: сдвинуть системный указатель на dx, dy (только Windows; на macOS — нет).
#[tauri::command]
fn nudge_cursor(app: AppHandle, dx: i32, dy: i32) {
    #[cfg(windows)]
    {
        if let Ok(c) = app.cursor_position() {
            use windows_sys::Win32::UI::WindowsAndMessaging::SetCursorPos;
            unsafe { SetCursorPos(c.x as i32 + dx, c.y as i32 + dy); }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (app, dx, dy);
    }
}

/// Фото питомца: PNG (base64 без префикса) в папку «Изображения/Котик».
#[tauri::command]
fn save_photo(app: AppHandle, name: String, png: String) -> Result<String, String> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD.decode(png).map_err(|e| e.to_string())?;
    let dir = app.path().picture_dir().map_err(|e| e.to_string())?.join("Котик");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe: String = name.chars().filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-').take(30).collect();
    let stamp = today();
    let mut n = 0;
    let path = loop {
        let p = dir.join(if n == 0 { format!("{safe} {stamp}.png") } else { format!("{safe} {stamp} ({n}).png") });
        if !p.exists() { break p; }
        n += 1;
    };
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn caldav_get(st: State<AppState>) -> serde_json::Value {
    let c = st.cfg.lock().unwrap().caldav.clone();
    serde_json::json!({ "user": c.user, "has_pass": !c.pass.is_empty() })
}

/// Пустой логин — отключить; пустой пароль при заданном логине — оставить прежний.
#[tauri::command]
fn caldav_set(app: AppHandle, user: String, pass: String) {
    let st = app.state::<AppState>();
    {
        let mut c = st.cfg.lock().unwrap();
        let user = user.trim().to_string();
        if user.is_empty() { c.caldav = CalDav::default(); }
        else { c.caldav.user = user; if !pass.is_empty() { c.caldav.pass = pass; } }
    }
    st.save();
    let _ = app.emit("caldav", ());
}

/// "20260923T120000Z" из unix-секунд (григорианский календарь, без chrono).
fn utc_stamp(secs: i64) -> String {
    let days = secs.div_euclid(86400); let rem = secs.rem_euclid(86400);
    let (h, m, s) = (rem / 3600, rem % 3600 / 60, rem % 60);
    let z = days + 719468; let era = z.div_euclid(146097); let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1; let mo = if mp < 10 { mp + 3 } else { mp - 9 }; let y = if mo <= 2 { y + 1 } else { y };
    format!("{:04}{:02}{:02}T{:02}{:02}{:02}Z", y, mo, d, h, m, s)
}

fn xml_unescape(s: &str) -> String {
    s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&#13;", "\r").replace("&#10;", "\n").replace("&amp;", "&")
}

/// Позиции открывающих тегов `<name>` / `<x:name ...>` в XML без учёта регистра (закрывающие `</…>` пропускаются).
fn xml_open_tags(lower: &str, name: &str) -> Vec<usize> {
    let mut out = Vec::new();
    let mut pos = 0;
    while let Some(i) = lower[pos..].find(name) {
        let at = pos + i;
        let after = lower[at + name.len()..].chars().next().unwrap_or(' ');
        let b = lower.as_bytes();
        let mut j = at;
        if j > 0 && b[j - 1] == b':' { j -= 1; while j > 0 && b[j - 1].is_ascii_alphanumeric() { j -= 1; } }   // префикс «d:»
        let lt = if j > 0 { b[j - 1] } else { b' ' };
        if lt == b'<' && (after == '>' || after == ' ' || after == '/') { out.push(j - 1); }
        pos = at + name.len();
    }
    out
}

/// Есть ли в блоке пустой/открывающий тег `calendar` (в любом префиксе) — признак коллекции-календаря.
fn has_calendar_tag(lower: &str) -> bool {
    xml_open_tags(lower, "calendar").iter().any(|&p| {
        let tail = &lower[p..];
        let end = tail.find('>').unwrap_or(tail.len());
        let tag = &tail[..end];
        !tag.contains("calendar-") && !tag.contains("calendar_")
    })
}

/// Календари учётки: PROPFIND по домашней коллекции → href'ы коллекций с resourcetype calendar.
async fn caldav_calendars(client: &reqwest::Client, user: &str, pass: &str) -> Result<(Vec<String>, String), String> {
    let base = "https://caldav.yandex.ru";
    let home = format!("{}/calendars/{}/", base, user);
    let propfind = r#"<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>"#;
    let resp = client.request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &home)
        .basic_auth(user, Some(pass)).header("Depth", "1").header("Content-Type", "application/xml; charset=utf-8").body(propfind)
        .send().await.map_err(|e| format!("нет связи с caldav.yandex.ru: {}", e))?;
    let code = resp.status().as_u16();
    if code == 401 || code == 403 { return Err("Яндекс не принял логин или пароль приложения".into()); }
    if code != 207 { return Err(format!("caldav.yandex.ru ответил {}", code)); }
    let xml = resp.text().await.map_err(|e| e.to_string())?;
    let lower = xml.to_lowercase();
    let starts = xml_open_tags(&lower, "response");
    let mut hrefs: Vec<String> = Vec::new();
    for (k, &st) in starts.iter().enumerate() {
        let en = starts.get(k + 1).copied().unwrap_or(lower.len());
        let block = &lower[st..en];
        if !has_calendar_tag(block) { continue; }
        let Some(h0) = block.find("href") else { continue };
        let Some(gt) = block[h0..].find('>') else { continue };
        let cs = st + h0 + gt + 1;
        let Some(ce) = lower[cs..].find("</") else { continue };
        let href = xml_unescape(xml[cs..cs + ce].trim());
        if href.trim_end_matches('/') != home.trim_end_matches('/') && !href.trim_end_matches('/').ends_with(&format!("/calendars/{}", user)) && !hrefs.contains(&href) { hrefs.push(href); }
    }
    Ok((hrefs, xml))
}

/// События календаря за окно [t0, t1] в виде ICS (склейка calendar-data). Сначала с раскрытием повторов, при отказе — без.
async fn caldav_report(client: &reqwest::Client, user: &str, pass: &str, href: &str, t0: &str, t1: &str) -> Result<(u16, String), String> {
    let url = if href.starts_with("http") { href.to_string() } else { format!("https://caldav.yandex.ru{}", href) };
    let mut last_code = 0u16;
    for expand in [true, false] {
        let data = if expand { format!(r#"<c:calendar-data><c:expand start="{}" end="{}"/></c:calendar-data>"#, t0, t1) } else { "<c:calendar-data/>".to_string() };
        let report = format!(r#"<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/>{}</d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="{}" end="{}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>"#, data, t0, t1);
        let r = client.request(reqwest::Method::from_bytes(b"REPORT").unwrap(), &url)
            .basic_auth(user, Some(pass)).header("Depth", "1").header("Content-Type", "application/xml; charset=utf-8").body(report)
            .send().await.map_err(|e| e.to_string())?;
        last_code = r.status().as_u16();
        if last_code != 207 { continue; }
        let body = r.text().await.unwrap_or_default();
        let low = body.to_lowercase();
        let mut out = String::new();
        for p in xml_open_tags(&low, "calendar-data") {
            let Some(gt) = low[p..].find('>') else { continue };
            if low[p..p + gt + 1].ends_with("/>") { continue; }
            let cs = p + gt + 1;
            let Some(ce) = low[cs..].find("</") else { continue };
            let raw = &body[cs..cs + ce];
            let raw = raw.trim().trim_start_matches("<![CDATA[").trim_end_matches("]]>");
            let ics = xml_unescape(raw);
            if ics.contains("BEGIN:VEVENT") { out.push_str(&ics); out.push('\n'); }
        }
        if !out.is_empty() || !expand { return Ok((last_code, out)); }
    }
    Ok((last_code, String::new()))
}

/// События ближайших `days` дней из всех календарей учётки — склейка ICS, разбор на стороне питомца.
#[tauri::command]
async fn caldav_fetch(app: AppHandle, days: Option<i64>) -> Result<String, String> {
    let (user, pass) = { let c = app.state::<AppState>().cfg.lock().unwrap().caldav.clone(); (c.user, c.pass) };
    if user.is_empty() || pass.is_empty() { return Ok(String::new()); }
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(25)).build().map_err(|e| e.to_string())?;
    let (hrefs, _) = caldav_calendars(&client, &user, &pass).await?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
    let (t0, t1) = (utc_stamp(now - 3600), utc_stamp(now + days.unwrap_or(2).max(1) * 86400));
    let mut out = String::new();
    for href in hrefs {
        if let Ok((_, ics)) = caldav_report(&client, &user, &pass, &href, &t0, &t1).await { out.push_str(&ics); }
    }
    Ok(out)
}

/// Диагностика для кнопки «проверить»: сколько календарей нашлось, что ответил каждый, сколько событий за неделю.
#[tauri::command]
async fn caldav_diag(app: AppHandle) -> Result<String, String> {
    let (user, pass) = { let c = app.state::<AppState>().cfg.lock().unwrap().caldav.clone(); (c.user, c.pass) };
    if user.is_empty() || pass.is_empty() { return Err("не задан логин или пароль".into()); }
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(25)).build().map_err(|e| e.to_string())?;
    let (hrefs, xml) = caldav_calendars(&client, &user, &pass).await?;
    if hrefs.is_empty() {
        let snip: String = xml.chars().take(600).collect();
        return Ok(format!("вход есть, но календарей не найдено. Ответ сервера: {}", snip.replace('\n', " ")));
    }
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
    let (t0, t1) = (utc_stamp(now - 3600), utc_stamp(now + 7 * 86400));
    let mut lines = vec![format!("календарей: {}", hrefs.len())];
    let mut total = 0;
    for href in &hrefs {
        match caldav_report(&client, &user, &pass, href, &t0, &t1).await {
            Ok((code, ics)) => { let n = ics.matches("BEGIN:VEVENT").count(); total += n; lines.push(format!("{} → {} , событий за неделю: {}", href, code, n)); }
            Err(e) => lines.push(format!("{} → ошибка: {}", href, e)),
        }
    }
    lines.push(format!("итого событий за неделю: {}", total));
    Ok(lines.join("; "))
}

// ---------- рабочий стол: активное окно (только Windows) ----------
// Питомцы сидят на верхней кромке активного окна и реагируют на приложение по его заголовку.
// Заголовок читается локально и никуда не передаётся. Клавиатуру приложение не трогает.
#[derive(Serialize, Clone, Default)]
struct Desk {
    title: String,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    maximized: bool,
}

/// Активное окно: заголовок и рамка (по DWM — без невидимых полей Win10/11). Своё, рабочий стол и
/// панель задач не считаются окном.
#[tauri::command]
fn desk_info() -> Desk {
    let mut d = Desk::default();
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::Foundation::RECT;
        use windows_sys::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
        use windows_sys::Win32::UI::WindowsAndMessaging::{GetClassNameW, GetForegroundWindow, GetWindowTextW, IsZoomed};
        let h = GetForegroundWindow();
        if h.is_null() { return d; }
        let mut cls = [0u16; 64];
        let n = GetClassNameW(h, cls.as_mut_ptr(), 64) as usize;
        let cls = String::from_utf16_lossy(&cls[..n]);
        if matches!(cls.as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd" | "Windows.UI.Core.CoreWindow") { return d; }
        let mut buf = [0u16; 256];
        let n = GetWindowTextW(h, buf.as_mut_ptr(), 256) as usize;
        let title = String::from_utf16_lossy(&buf[..n]);
        if title.is_empty() || title == "Котик" || title.starts_with("Питомцы") { return d; }
        let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        let ok = DwmGetWindowAttribute(h, DWMWA_EXTENDED_FRAME_BOUNDS as u32, &mut r as *mut RECT as *mut _, std::mem::size_of::<RECT>() as u32) == 0;
        if !ok { return d; }
        d.title = title;
        d.x = r.left; d.y = r.top; d.w = r.right - r.left; d.h = r.bottom - r.top;
        d.maximized = IsZoomed(h) != 0;
    }
    d
}

// ---------- гости: личность приложения, окно гостя, спрятать/показать питомца ----------
#[derive(Serialize)]
struct WhoAmI {
    client: String,
    user: String,
    host: String,
    visits: bool,
    version: String,   // версия приложения — уходит на портал в /hello, видна в списке «кто онлайн»
}

/// Случайный постоянный id приложения плюс логин и имя компьютера — для регистрации на портале.
#[tauri::command]
fn whoami(st: State<AppState>) -> WhoAmI {
    let (client, visits) = { let c = st.cfg.lock().unwrap(); (c.client_id.clone(), c.visits) };
    let user = std::env::var("USERNAME").or_else(|_| std::env::var("USER")).unwrap_or_default();
    let host = std::env::var("COMPUTERNAME").ok().filter(|s| !s.is_empty()).unwrap_or_else(|| {
        fs::read_to_string("/etc/hostname").map(|s| s.trim().to_string()).ok().filter(|s| !s.is_empty()).unwrap_or_else(|| {
            std::process::Command::new("hostname").output().ok().map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).unwrap_or_default()
        })
    });
    WhoAmI { client, user, host, visits, version: env!("CARGO_PKG_VERSION").to_string() }
}

/// Открыть страницу портала в системном браузере (только адреса из edition.rs).
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !edition::OPEN_URL_PREFIXES.iter().any(|p| url.starts_with(p)) { return Err("не наш адрес".into()); }
    #[cfg(windows)]
    { std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")]
    { std::process::Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?; }
    #[cfg(not(any(windows, target_os = "macos")))]
    { std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

/// Отправить конкретного питомца в гости к выбранному коллеге (окно «Питомцы» → «в гости к…»).
#[tauri::command]
fn pet_visit(app: AppHandle, label: String, to: String, name: String, msg: Option<String>) {
    let msg: String = msg.unwrap_or_default().chars().take(120).collect();
    let _ = app.emit("visit-to", serde_json::json!({ "label": label, "to": to, "name": name, "msg": msg }));
}

/// Вернуть всех питомцев из гостей и показать окна (кнопка «вернуть всех» в окне «Питомцы»).
#[tauri::command]
fn pets_recall(app: AppHandle) {
    let _ = app.emit("recall", ());
    for w in app.webview_windows().values() { if w.label().starts_with("pet") { let _ = w.show(); } }
}

#[tauri::command]
fn visits_set(app: AppHandle, on: bool) {
    let st = app.state::<AppState>();
    st.cfg.lock().unwrap().visits = on;
    st.save();
    let _ = app.emit("visits", on);
}

/// Спрятать или показать окно питомца (ушёл в гости / вернулся).
#[tauri::command]
fn pet_visible(app: AppHandle, label: String, on: bool) {
    if let Some(w) = app.get_webview_window(&label) {
        let _ = if on { w.show() } else { w.hide() };
    }
}

/// Окно гостя: чужой питомец на пару минут. В список своих не попадает; в конфиг пишется только
/// на время визита, чтобы гость пережил перезапуск приложения (тихое обновление).
fn guest_window(app: &AppHandle, p: Pet) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("guest") { let _ = w.destroy(); }
    let init = serde_json::to_string(&p).unwrap_or_default();
    let builder = WebviewWindowBuilder::new(app, "guest", WebviewUrl::App("index.html".into()))
        .title("Гость")
        .inner_size(220.0, 180.0)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(false)
        .focusable(false)
        .visible(false)
        .initialization_script(format!("window.PET = {init};"));
    #[cfg(windows)]
    let builder = builder.additional_browser_args(
        "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required",
    );
    let w = builder.build().map_err(|e| e.to_string())?;
    // выходит из-за левого края того монитора, где сейчас курсор (туда смотрит человек), иначе основного
    let cur = app.cursor_position().ok();
    let mon = w.available_monitors().unwrap_or_default().into_iter().find(|m| cur.map(|c| {
        let (p, sz) = (m.position(), m.size());
        c.x >= p.x as f64 && c.x < (p.x + sz.width as i32) as f64 && c.y >= p.y as f64 && c.y < (p.y + sz.height as i32) as f64
    }).unwrap_or(false)).or_else(|| w.primary_monitor().ok().flatten());
    if let Some(m) = mon {
        let wa = m.work_area();
        let _ = w.set_position(PhysicalPosition::new(wa.position.x - 230, wa.position.y + wa.size.height as i32 - 180));
    }
    let _ = w.show();
    Ok(())
}

#[tauri::command]
async fn guest_show(app: AppHandle, pet: Pet, owner: String, dur: Option<f64>) -> Result<(), String> {   // f64: старые клиенты шлют дробный срок, u64 его отвергал — гость не появлялся
    let mut p = pet;
    p.label = "guest".into();
    p.guest = true;
    p.owner = owner.chars().take(60).collect();
    p.dur = (dur.filter(|d| d.is_finite()).map(|d| d.round().max(0.0) as u64).unwrap_or(150_000)).clamp(20_000, 600_000);
    if !SPECIES.contains(&p.sp.as_str()) { p.sp = "cat".into(); }
    p.color %= COLORS;
    {
        let st = app.state::<AppState>();
        st.cfg.lock().unwrap().guest = Some(GuestSaved { pet: p.clone(), owner: p.owner.clone(), until: now_ms() + p.dur });
        st.save();
    }
    guest_window(&app, p)
}

/// При старте: если гость по конфигу ещё не догостил — вернуть его на остаток срока.
fn guest_restore(app: &AppHandle) {
    let st = app.state::<AppState>();
    let g = st.cfg.lock().unwrap().guest.clone();
    let Some(g) = g else { return };
    let now = now_ms();
    if g.until > now + 15_000 {
        let mut p = g.pet;
        p.label = "guest".into(); p.guest = true; p.owner = g.owner; p.dur = g.until - now;
        let _ = guest_window(app, p);
    } else {
        st.cfg.lock().unwrap().guest = None;
        st.save();
    }
}

#[tauri::command]
fn guest_hide(app: AppHandle) {
    if let Some(w) = app.get_webview_window("guest") { let _ = w.destroy(); }
    let st = app.state::<AppState>();
    if st.cfg.lock().unwrap().guest.take().is_some() { st.save(); }
}

// ---------- голос, тихий режим, экспорт ----------
/// Произнести фразу системным синтезатором: Windows — SAPI через PowerShell без окна, macOS — say.
/// Текст режется до 200 символов и уходит через stdin/аргумент без кавычек-инъекций.
#[tauri::command]
fn speak(text: String) {
    let t: String = text.chars().filter(|c| !c.is_control()).take(200).collect();
    if t.trim().is_empty() { return; }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let script = format!("Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 0; $s.Speak([Console]::In.ReadToEnd())");
        if let Ok(mut p) = std::process::Command::new("powershell").args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
            .stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null()).creation_flags(0x08000000).spawn() {
            use std::io::Write;
            if let Some(mut si) = p.stdin.take() { let _ = si.write_all(t.as_bytes()); }
            std::thread::spawn(move || { let _ = p.wait(); });
        }
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("say").arg("-v").arg("Milena").arg(&t).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null()).spawn().map(|mut p| std::thread::spawn(move || { let _ = p.wait(); }));
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    { let _ = t; }
}

#[tauri::command]
fn tts_get(st: State<AppState>) -> bool {
    st.cfg.lock().unwrap().tts
}

/// Сохранить питомцев файлом в Документы/Котик — для переноса на другой компьютер.
#[tauri::command]
fn export_pets(app: AppHandle, json: String) -> Result<String, String> {
    let dir = app.path().document_dir().map_err(|e| e.to_string())?.join("Котик");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = format!("kotik-pets-{}.json", today());
    let path = dir.join(&name);
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

// ---------- клавиши-комбинации и уровень звука (только Windows) ----------
// Клавиатура: НЕ сканируем клавиши. Опрашиваются только две комбинации — Ctrl+S и Ctrl+Z — и
// системное «время с последнего ввода» (как у хранителя экрана). Ничего не пишется и не уходит
// с компьютера; включается вручную в трее («Реагировать на Ctrl+S / Ctrl+Z»), по умолчанию выключено.
// Звук: пиковый уровень вывода через штатный измеритель WASAPI (IAudioMeterInformation) — это
// не запись звука, только число 0…1 для танцев под музыку.
static KEY_CTRL_S: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
static KEY_CTRL_Z: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
static KEYS_ON: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static AUDIO_PEAK: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);   // пик × 1000

#[cfg(windows)]
fn keys_thread() {
    use std::sync::atomic::Ordering::Relaxed;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_CONTROL};
    std::thread::spawn(move || {
        let (mut s_down, mut z_down) = (false, false);
        loop {
            std::thread::sleep(std::time::Duration::from_millis(30));
            if !KEYS_ON.load(Relaxed) { s_down = false; z_down = false; std::thread::sleep(std::time::Duration::from_millis(500)); continue; }
            let ctrl = unsafe { (GetAsyncKeyState(VK_CONTROL as i32) as u16 & 0x8000) != 0 };
            let s = ctrl && unsafe { (GetAsyncKeyState(0x53) as u16 & 0x8000) != 0 };
            let z = ctrl && unsafe { (GetAsyncKeyState(0x5A) as u16 & 0x8000) != 0 };
            if s && !s_down { KEY_CTRL_S.fetch_add(1, Relaxed); }
            if z && !z_down { KEY_CTRL_Z.fetch_add(1, Relaxed); }
            s_down = s; z_down = z;
        }
    });
}
#[cfg(not(windows))]
fn keys_thread() {}

#[cfg(windows)]
fn audio_thread() {
    use std::sync::atomic::Ordering::Relaxed;
    use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
    use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
    std::thread::spawn(move || {
        let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        let open = || -> Option<IAudioMeterInformation> {
            unsafe {
                let en: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
                let dev = en.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
                dev.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None).ok()
            }
        };
        let mut meter: Option<IAudioMeterInformation> = None;
        loop {
            if meter.is_none() {
                meter = open();
                if meter.is_none() { std::thread::sleep(std::time::Duration::from_secs(30)); continue; }
            }
            match unsafe { meter.as_ref().unwrap().GetPeakValue() } {
                Ok(peak) => AUDIO_PEAK.store((peak.clamp(0.0, 1.0) * 1000.0) as u32, Relaxed),
                Err(_) => { meter = None; continue; }   // устройство сменилось — переоткрыть
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    });
}
#[cfg(not(windows))]
fn audio_thread() {}

#[tauri::command]
fn keys_set(app: AppHandle, on: bool) {
    let st = app.state::<AppState>();
    st.cfg.lock().unwrap().keys = on;
    st.save();
    KEYS_ON.store(on, std::sync::atomic::Ordering::Relaxed);
    let _ = app.emit("keys", on);
}

#[derive(Serialize, Clone, Default)]
struct Input {
    keys: bool,      // реакции на комбинации включены
    idle_ms: u64,    // сколько мс не было ни мыши, ни клавиатуры (системное)
    ctrl_s: u32,
    ctrl_z: u32,
    peak: f32,       // уровень звука 0…1
}

#[tauri::command]
fn input_info(st: State<AppState>) -> Input {
    use std::sync::atomic::Ordering::Relaxed;
    let mut i = Input { keys: st.cfg.lock().unwrap().keys, ctrl_s: KEY_CTRL_S.load(Relaxed), ctrl_z: KEY_CTRL_Z.load(Relaxed), peak: AUDIO_PEAK.load(Relaxed) as f32 / 1000.0, ..Default::default() };
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::System::SystemInformation::GetTickCount;
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
        let mut li = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
        if GetLastInputInfo(&mut li) != 0 { i.idle_ms = GetTickCount().wrapping_sub(li.dwTime) as u64; }
    }
    i
}

#[tauri::command]
fn calendar_get(st: State<AppState>) -> String {
    st.cfg.lock().unwrap().calendar.clone()
}

#[tauri::command]
fn calendar_set(app: AppHandle, url: String) {
    let st = app.state::<AppState>();
    st.cfg.lock().unwrap().calendar = url.trim().to_string();
    st.save();
    let _ = app.emit("calendar", st.cfg.lock().unwrap().calendar.clone());
}

/// Идёт ли звонок: Windows ведёт журнал доступа к микрофону и захвату экрана —
/// у приложения, которое пишет сейчас, LastUsedTimeStop == 0.
#[cfg(windows)]
fn in_call() -> bool {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hk = RegKey::predef(HKEY_CURRENT_USER);
    for cap in ["microphone", "webcam", "graphicsCaptureProgrammatic", "graphicsCaptureWithoutBorder"] {
        let base = format!("Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\{cap}");
        let Ok(root) = hk.open_subkey(&base) else { continue };
        let mut subs: Vec<String> = root.enum_keys().flatten().collect();
        if let Ok(np) = root.open_subkey("NonPackaged") {
            subs.extend(np.enum_keys().flatten().map(|k| format!("NonPackaged\\{k}")));
        }
        for sub in subs {
            if sub == "NonPackaged" { continue; }
            if let Ok(k) = root.open_subkey(&sub) {
                let stop: u64 = k.get_value("LastUsedTimeStop").unwrap_or(1);
                let start: u64 = k.get_value("LastUsedTimeStart").unwrap_or(0);
                if stop == 0 && start > 0 { return true; }
            }
        }
    }
    false
}
#[cfg(not(windows))]
fn in_call() -> bool {
    false
}

/// Лежанку двигает человек — запоминаем, где стоит.
#[tauri::command]
fn bed_pos(app: AppHandle, x: i32, y: i32) {
    let st = app.state::<AppState>();
    {
        let mut c = st.cfg.lock().unwrap();
        c.bed.x = x;
        c.bed.y = y;
    }
    st.save();
}

fn spawn_prop(app: &AppHandle, kind: &str) {
    let c = app.cursor_position().unwrap_or_default();
    let (x, y) = (c.x as i32, c.y as i32);
    let h = app.clone();
    let k = kind.to_string();
    tauri::async_runtime::spawn(async move { let _ = prop_show(h, k, x, y, None).await; });
}

/// Открыть (или поднять) окно «Питомцы»; `label` — какого питомца выделить.
#[tauri::command]
async fn open_settings(app: AppHandle, label: Option<String>) {
    show_settings(&app, label);
}

fn show_settings(app: &AppHandle, label: Option<String>) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        let _ = app.emit_to("settings", "select-pet", label);
        return;
    }
    let sel = serde_json::to_string(&label).unwrap_or("null".into());
    // размер — от рабочей области монитора с курсором (до 980×1040 логических), по центру этого монитора;
    // дальше страница сама подгоняет высоту под содержимое (settings_fit)
    let cur = app.cursor_position().ok();
    let mon = app.available_monitors().unwrap_or_default().into_iter().find(|m| cur.map(|c| {
        let p = m.position(); let sz = m.size();
        c.x >= p.x as f64 && c.x < (p.x + sz.width as i32) as f64 && c.y >= p.y as f64 && c.y < (p.y + sz.height as i32) as f64
    }).unwrap_or(false)).or_else(|| app.primary_monitor().ok().flatten());
    let (w, h, x, y) = match mon {
        Some(m) => {
            let s = m.scale_factor(); let wa = m.work_area();
            let ww = wa.size.width as f64 / s; let wh = wa.size.height as f64 / s;
            let w = (ww * 0.92).min(980.0); let h = (wh * 0.92).min(1040.0);
            (w, h, wa.position.x as f64 / s + (ww - w) / 2.0, wa.position.y as f64 / s + (wh - h) / 2.0)
        }
        None => (560.0, 680.0, 120.0, 80.0),
    };
    let _ = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
        .title("Питомцы")
        .inner_size(w, h)
        .min_inner_size(420.0, 420.0)
        .position(x, y)
        .initialization_script(format!("window.SELECT_PET = {sel};"))
        .build();
}

/// Окно «Питомцы» подгоняет высоту под содержимое страницы (h — логические пиксели): не меньше 420,
/// не выше рабочей области монитора; если низ уехал бы за экран — окно поднимается.
#[tauri::command]
fn settings_fit(window: WebviewWindow, h: f64) {
    let Ok(Some(m)) = window.current_monitor() else { return };
    let s = m.scale_factor(); let wa = m.work_area();
    let top = wa.position.y as f64 / s; let wh = wa.size.height as f64 / s;
    let cur = window.inner_size().map(|p| p.to_logical::<f64>(s)).unwrap_or(LogicalSize::new(560.0, 680.0));
    let frame = window.outer_size().map(|o| o.to_logical::<f64>(s).height - cur.height).unwrap_or(40.0).max(0.0);
    let nh = (h + 8.0).max(420.0).min(wh - frame - 16.0);
    if (nh - cur.height).abs() < 2.0 { return; }
    let _ = window.set_size(LogicalSize::new(cur.width, nh));
    if let Ok(pos) = window.outer_position() {
        let p = pos.to_logical::<f64>(s);
        let bottom = p.y + nh + frame; let limit = top + wh - 8.0;
        if bottom > limit { let _ = window.set_position(LogicalPosition::new(p.x, (p.y - (bottom - limit)).max(top))); }
    }
}

/// Проверка обновления с портала: есть — ставим молча и перезапускаемся. Пока у нас гость или свой
/// питомец в гостях (окно спрятано), перезапуск оборвал бы визит — тогда откладываем (Ok(false)),
/// клиент повторит через 5 минут; шестичасовой цикл повторит сам.
async fn update_once(app: &AppHandle) -> Result<bool, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let Some(u) = updater.check().await.map_err(|e| e.to_string())? else { return Ok(true) };
    let busy = app.get_webview_window("guest").is_some() || {
        let st = app.state::<AppState>();
        let labels: Vec<String> = st.live.lock().unwrap().iter().map(|p| p.label.clone()).collect();
        labels.iter().any(|l| app.get_webview_window(l).map(|w| !w.is_visible().unwrap_or(true)).unwrap_or(false))
    };
    if busy { return Ok(false); }
    u.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    app.restart();
}

/// Портал сообщил о новой версии (ответ /hello) — обновиться сейчас, не дожидаясь шестичасовой проверки.
#[tauri::command]
async fn update_now(app: AppHandle) -> Result<bool, String> {
    update_once(&app).await
}

pub fn run() {
    let app = tauri::Builder::default()
        // второй запуск exe — ещё один котик
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = spawn_pet(app, "cat", None);
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![frame, screens, pets_list, pet_update, pet_add, pet_add_custom, pet_remove, open_settings, settings_fit, prop_show, prop_hide, bed_pos, nudge_cursor, save_photo, calendar_get, calendar_set, caldav_get, caldav_set, caldav_fetch, caldav_diag, desk_info, whoami, visits_set, pet_visible, guest_show, guest_hide, speak, tts_get, export_pets, keys_set, input_info, pets_recall, pet_visit, open_url, update_now])
        .setup(|app| {
            let path = app.path().app_config_dir()?.join("settings.json");
            let mut cfg: Cfg = fs::read_to_string(&path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
            if cfg.client_id.len() < 8 { cfg.client_id = format!("k{:016x}{:08x}", rand(), rand() as u32); }
            let sound = cfg.sound;
            let (bed_on, bed_xy) = (cfg.bed.on, (cfg.bed.x, cfg.bed.y));
            let mut pets: Vec<Pet> = cfg.pets.iter().filter(|p| SPECIES.contains(&p.sp.as_str())).take(MAX_PETS).cloned().collect();
            if pets.is_empty() {
                pets = Cfg::default().pets;
            }
            app.manage(AppState { cfg: Mutex::new(cfg), path, live: Mutex::new(Vec::new()) });

            keys_thread();
            audio_thread();
            let h = app.handle();
            let auto_on = h.autolaunch().is_enabled().unwrap_or(false);
            let sound_item = CheckMenuItem::with_id(h, "sound", "Звук", true, sound, None::<&str>)?;
            let tts_on = { app.state::<AppState>().cfg.lock().unwrap().tts };
            let tts_item = CheckMenuItem::with_id(h, "tts", "Говорить голосом", true, tts_on, None::<&str>)?;
            let keys_on = { app.state::<AppState>().cfg.lock().unwrap().keys };
            KEYS_ON.store(keys_on, std::sync::atomic::Ordering::Relaxed);
            let keys_item = CheckMenuItem::with_id(h, "keys", "Реагировать на Ctrl+S / Ctrl+Z", true, keys_on, None::<&str>)?;
            let quiet_item = CheckMenuItem::with_id(h, "quiet", "Тихий режим на 2 часа", true, false, None::<&str>)?;
            let tricks = Submenu::with_items(h, "Трюки", true, &[
                &MenuItem::with_id(h, "trick_sit", "Сидеть", true, None::<&str>)?, &MenuItem::with_id(h, "trick_paw", "Дай лапу", true, None::<&str>)?,
                &MenuItem::with_id(h, "trick_roll", "Кувырок", true, None::<&str>)?, &MenuItem::with_id(h, "trick_voice", "Голос", true, None::<&str>)?,
                &MenuItem::with_id(h, "trick_dance", "Танцуй", true, None::<&str>)?,
            ])?;
            let foods = Submenu::with_items(h, "Покормить…", true, &[
                &MenuItem::with_id(h, "feed_fish", "🐟 Рыба", true, None::<&str>)?, &MenuItem::with_id(h, "feed_bone", "🦴 Косточка", true, None::<&str>)?,
                &MenuItem::with_id(h, "feed_seeds", "🌻 Семечки", true, None::<&str>)?, &MenuItem::with_id(h, "feed_carrot", "🥕 Морковка", true, None::<&str>)?,
                &MenuItem::with_id(h, "feed_apple", "🍎 Яблоко", true, None::<&str>)?, &MenuItem::with_id(h, "feed_water", "💧 Вода", true, None::<&str>)?,
            ])?;
            let bed_item = CheckMenuItem::with_id(h, "bed", "Лежанка", true, bed_on, None::<&str>)?;
            let auto_item = CheckMenuItem::with_id(h, "autostart", if cfg!(target_os = "macos") { "Запускать при входе в macOS" } else { "Запускать вместе с Windows" }, true, auto_on, None::<&str>)?;
            let menu = Menu::with_items(
                h,
                &[
                    &MenuItem::with_id(h, "ver", format!("Котик {}", app.package_info().version), false, None::<&str>)?,
                    &PredefinedMenuItem::separator(h)?,
                    &MenuItem::with_id(h, "come", "Позвать всех", true, None::<&str>)?,
                    &MenuItem::with_id(h, "feed", "Покормить", true, None::<&str>)?,
                    &foods,
                    &MenuItem::with_id(h, "cure", "Лечить", true, None::<&str>)?,
                    &MenuItem::with_id(h, "play", "Поиграть с мышкой", true, None::<&str>)?,
                    &MenuItem::with_id(h, "voice", "Голос!", true, None::<&str>)?,
                    &MenuItem::with_id(h, "cheer", "Подбодри меня", true, None::<&str>)?,
                    &MenuItem::with_id(h, "photo", "Фото питомцев", true, None::<&str>)?,
                    &tricks,
                    &quiet_item,
                    &MenuItem::with_id(h, "hide", "Прятки", true, None::<&str>)?,
                    &MenuItem::with_id(h, "disco", "Дискотека для всех!", true, None::<&str>)?,
                    &MenuItem::with_id(h, "shell", "Угадай лапу", true, None::<&str>)?,
                    &MenuItem::with_id(h, "pomodoro", "Помидор 25/5 (вкл/выкл)", true, None::<&str>)?,
                    &MenuItem::with_id(h, "ball", "Мячик!", true, None::<&str>)?,
                    &MenuItem::with_id(h, "laser", "Лазер!", true, None::<&str>)?,
                    &MenuItem::with_id(h, "butterfly", "Бабочка", true, None::<&str>)?,
                    &MenuItem::with_id(h, "mouse", "Мышь!", true, None::<&str>)?,
                    &MenuItem::with_id(h, "bubbles", "Мыльные пузыри", true, None::<&str>)?,
                    &MenuItem::with_id(h, "nest", "Гнездо", true, None::<&str>)?,
                    &MenuItem::with_id(h, "yarn", "Клубок ниток", true, None::<&str>)?,
                    &MenuItem::with_id(h, "post", "Когтеточка", true, None::<&str>)?,
                    &MenuItem::with_id(h, "clear_props", "Убрать все игрушки", true, None::<&str>)?,
                    &bed_item,
                    &MenuItem::with_id(h, "sleep", "Уложить спать", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(h)?,
                    &MenuItem::with_id(h, "more", "Ещё котик", true, None::<&str>)?,
                    &MenuItem::with_id(h, "puppy", "Щенок", true, None::<&str>)?,
                    &MenuItem::with_id(h, "hamster", "Хомячок", true, None::<&str>)?,
                    &MenuItem::with_id(h, "bird", "Попугай", true, None::<&str>)?,
                    &MenuItem::with_id(h, "rabbit", "Кролик", true, None::<&str>)?,
                    &MenuItem::with_id(h, "dragon", "Дракончик", true, None::<&str>)?,
                    &MenuItem::with_id(h, "kuzya", "Домовёнок Кузя", true, None::<&str>)?,
                    &MenuItem::with_id(h, "clippy", "Скрепка", true, None::<&str>)?,
                    &MenuItem::with_id(h, "less", "Убрать последнего", true, None::<&str>)?,
                    &MenuItem::with_id(h, "settings", "Питомцы: окрас и вид…", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(h)?,
                    &sound_item,
                    &tts_item,
                    &keys_item,
                    &auto_item,
                    &PredefinedMenuItem::separator(h)?,
                    &MenuItem::with_id(h, "quit", "Выход", true, None::<&str>)?,
                ],
            )?;
            let (si, ai, bi, ti, qi, ki) = (sound_item.clone(), auto_item.clone(), bed_item.clone(), tts_item.clone(), quiet_item.clone(), keys_item.clone());
            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().cloned().expect("иконка"))
                .tooltip("Котик — щёлкни, чтобы позвать")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, ev| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                        let _ = tray.app_handle().emit("pet", "come");
                    }
                })
                .on_menu_event(move |app, ev| match ev.id().as_ref() {
                    "cure" => {
                        let _ = app.emit("cure", ());
                    }
                    "tts" => {
                        let st = app.state::<AppState>();
                        let v = { let mut c = st.cfg.lock().unwrap(); c.tts = !c.tts; c.tts };
                        st.save();
                        let _ = ti.set_checked(v);
                        let _ = app.emit("tts", v);
                    }
                    "keys" => {
                        let st = app.state::<AppState>();
                        let v = { let mut c = st.cfg.lock().unwrap(); c.keys = !c.keys; c.keys };
                        st.save();
                        KEYS_ON.store(v, std::sync::atomic::Ordering::Relaxed);
                        let _ = ki.set_checked(v);
                        let _ = app.emit("keys", v);
                    }
                    "quiet" => {
                        let on = qi.is_checked().unwrap_or(false);
                        let _ = app.emit("quiet", if on { 2 * 3600 * 1000u64 } else { 0 });
                        if on {
                            let qi2 = qi.clone();
                            std::thread::spawn(move || { std::thread::sleep(std::time::Duration::from_secs(2 * 3600)); let _ = qi2.set_checked(false); });
                        }
                    }
                    id @ ("trick_sit" | "trick_paw" | "trick_roll" | "trick_voice" | "trick_dance") => {
                        let _ = app.emit("trick", id.trim_start_matches("trick_"));
                    }
                    id if id.starts_with("feed_") => { let _ = app.emit("pet", id); }   // «Покормить…»: рыба, косточка, семечки, морковка, яблоко, вода
                    id @ ("come" | "feed" | "play" | "voice" | "sleep" | "cheer" | "hide" | "shell" | "pomodoro" | "photo" | "disco") => {
                        let _ = app.emit("pet", id);
                    }
                    "ball" => {
                        // мяч появляется у курсора; если уже есть — подпрыгивает к курсору
                        if app.get_webview_window("ball").is_some() {
                            let c = app.cursor_position().unwrap_or_default();
                            let _ = app.emit_to("ball", "prop-kick", serde_json::json!({ "kind": "ball", "x": c.x as i32, "y": c.y as i32, "vx": 0, "vy": -300 }));
                        } else {
                            spawn_prop(app, "ball");
                        }
                    }
                    "laser" => spawn_prop(app, "laser"),
                    "butterfly" => spawn_prop(app, "butterfly"),
                    "mouse" => {
                        // старая (или зависшая) мышь — убрать и выпустить новую; destroy асинхронный,
                        // поэтому новое окно с той же меткой создаём с задержкой, иначе prop_show увидит старое
                        let h = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Some(w) = h.get_webview_window("mouse") { let _ = w.destroy(); tokio_sleep(1).await; }
                            let c = h.cursor_position().unwrap_or_default();
                            let _ = prop_show(h.clone(), "mouse".into(), c.x as i32, c.y as i32, None).await;
                        });
                    }
                    "bubbles" => spawn_prop(app, "bubbles"),
                    "nest" => {
                        if let Some(w) = app.get_webview_window("nest") { let _ = w.destroy(); } else { spawn_prop(app, "nest"); }
                    }
                    "yarn" => spawn_prop(app, "yarn"),
                    "clear_props" => {
                        for k in PROPS.iter() {
                            if *k == "bed" { continue; }
                            if let Some(w) = app.get_webview_window(k) { let _ = w.destroy(); }
                        }
                    }
                    "post" => {
                        if let Some(w) = app.get_webview_window("post") { let _ = w.destroy(); } else { spawn_prop(app, "post"); }
                    }
                    "bed" => {
                        let st = app.state::<AppState>();
                        let on = { let mut c = st.cfg.lock().unwrap(); c.bed.on = !c.bed.on; c.bed.on };
                        st.save();
                        let _ = bi.set_checked(on);
                        if on {
                            let (x, y) = { let c = st.cfg.lock().unwrap(); (c.bed.x, c.bed.y) };
                            if x == 0 && y == 0 { spawn_prop(app, "bed"); } else { let h = app.clone(); tauri::async_runtime::spawn(async move { let _ = prop_show(h, "bed".into(), x, y, None).await; }); }
                        } else if let Some(w) = app.get_webview_window("bed") {
                            let _ = w.destroy();
                        }
                    }
                    "more" => {
                        let _ = spawn_pet(app, "cat", None);
                    }
                    "puppy" => {
                        let _ = spawn_pet(app, "dog", None);
                    }
                    "hamster" => {
                        let _ = spawn_pet(app, "hamster", None);
                    }
                    "bird" => {
                        let _ = spawn_pet(app, "bird", None);
                    }
                    "rabbit" => {
                        let _ = spawn_pet(app, "rabbit", None);
                    }
                    "dragon" => {
                        let _ = spawn_pet(app, "dragon", None);
                    }
                    "kuzya" => {
                        let _ = spawn_pet(app, "kuzya", None);
                    }
                    "clippy" => {
                        let _ = spawn_pet(app, "clippy", None);
                    }
                    "less" => remove_pet(app, None),
                    "settings" => show_settings(app, None),
                    "sound" => {
                        let st = app.state::<AppState>();
                        let v = {
                            let mut c = st.cfg.lock().unwrap();
                            c.sound = !c.sound;
                            c.sound
                        };
                        st.save();
                        let _ = si.set_checked(v);
                        let _ = app.emit("sound", v);
                    }
                    "autostart" => {
                        let al = app.autolaunch();
                        let on = !al.is_enabled().unwrap_or(false);
                        let _ = if on { al.enable() } else { al.disable() };
                        let _ = ai.set_checked(al.is_enabled().unwrap_or(on));
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            for p in pets {
                let sp = p.sp.clone();
                spawn_pet(h, &sp, Some(p))?;
            }
            guest_restore(h);   // гость, не догостивший до перезапуска (тихое обновление), возвращается на остаток срока
            if bed_on {
                let (x, y) = bed_xy;
                let hb = h.clone();
                tauri::async_runtime::spawn(async move { let _ = prop_show(hb, "bed".into(), x, y, None).await; });
            }
            // звонок: раз в 5 с смотрим микрофон/захват экрана, шлём питомцам call {on}
            let hc = h.clone();
            std::thread::spawn(move || {
                let mut last = None;
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    let on = in_call();
                    if last != Some(on) {
                        last = Some(on);
                        let _ = hc.emit("call", on);
                    }
                }
            });
            // обновления: через минуту после старта и раз в 6 часов
            let hu = h.clone();
            tauri::async_runtime::spawn(async move {
                tokio_sleep(60).await;
                loop {
                    let _ = update_once(&hu).await;
                    tokio_sleep(6 * 3600).await;
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("не удалось запустить котика");

    app.run(|_app, ev| {
        // закрыли последнего кота (Alt+F4) — остаёмся в трее, выход только из меню
        if let RunEvent::ExitRequested { code: None, api, .. } = ev {
            api.prevent_exit();
        }
    });
}
