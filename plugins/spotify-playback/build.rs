const COMMANDS: &[&str] = &[];

fn main() {
    let result = tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .try_build();

    if !(std::env::var_os("DOCS_RS").is_some()
        && std::env::var("TARGET")
            .map(|target| target.contains("android"))
            .unwrap_or(false))
    {
        result.unwrap();
    }
}
