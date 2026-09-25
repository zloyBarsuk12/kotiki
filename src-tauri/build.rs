fn main() {
    // Команды перечислены здесь, чтобы tauri-build сгенерировал права allow-<команда>
    // для capabilities/default.json — без этого вызов отклоняется молча.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["frame", "screens", "pets_list", "pet_update", "pet_add", "pet_add_custom", "pet_remove", "open_settings", "settings_fit", "prop_show", "prop_hide", "bed_pos", "nudge_cursor", "save_photo", "calendar_get", "calendar_set", "caldav_get", "caldav_set", "caldav_fetch", "caldav_diag", "desk_info", "whoami", "visits_set", "pet_visible", "guest_show", "guest_hide", "speak", "tts_get", "export_pets", "keys_set", "input_info", "pets_recall", "pet_visit", "open_url", "update_now"])),
    )
    .expect("tauri-build");
}
