#[tauri::command]
async fn runtime_probe() -> Result<String, String> {
    // The starter demonstrates the safe pattern for blocking filesystem/process/
    // database work: keep it off Tauri's async runtime thread.
    tauri::async_runtime::spawn_blocking(|| {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;
        format!("Tauri native runtime: {platform}/{arch}")
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![runtime_probe])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
