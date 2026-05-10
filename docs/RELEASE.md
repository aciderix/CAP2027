# Release procedure — Play Store publication

CAP 2027 ships to the Play Store as a signed **Android App Bundle (.aab)**.
The release flow is driven by the GitHub Actions workflow
`android-release.yml`, which produces a signed AAB you can upload via
the Play Console.

## One-time setup (do this once, keep the keystore safe forever)

### 1. Generate the upload keystore

On any machine with the JDK installed (`apt install default-jdk` /
`brew install openjdk`):

```bash
keytool -genkey -v \
  -keystore release.jks \
  -alias cap2027 \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Answer the prompts:
- Keystore password: pick a strong one (≥ 12 chars)
- Key alias password: another strong one (can be the same)
- Distinguished name fields: fill in (used in the cert, visible in
  Play Console metadata but not to end users)

⚠️ **CRITICAL** — back up `release.jks` to at least two safe places.
If you lose this keystore, **you can never update the app on the Play
Store again**. You'd have to publish a new app with a new package
name and lose every existing user.

Recommended backups:
- Encrypted password manager attachment (1Password, Bitwarden vault)
- Encrypted offline copy (LUKS-encrypted USB, etc.)

### 2. Encode the keystore for CI

```bash
base64 -w 0 release.jks > release.jks.b64
```

### 3. Configure GitHub repository secrets

Go to https://github.com/aciderix/CAP2027/settings/secrets/actions →
**New repository secret**, and add these four:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | full content of `release.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password you set |
| `ANDROID_KEY_ALIAS` | `cap2027` (or whatever alias you chose) |
| `ANDROID_KEY_PASSWORD` | the alias password you set |

### 4. Configure the Play Console (one-time, separate from CI)

- Open the Play Console (https://play.google.com/console), create an
  app with package name `fr.cap2027.app`.
- **Internal testing track** is the easiest entry point — limited
  audience, fast review.
- Enroll the app in **Play App Signing** (Google holds the production
  signing key; your keystore becomes the *upload* key).
- Fill in mandatory metadata: privacy policy URL, content rating,
  target audience, data safety form.

## Each release

1. Decide a `versionName` (visible to users, e.g. `1.0.0`) and a
   `versionCode` (integer, strictly increasing). Versioning rule:
   bump the patch for bug fixes, minor for features, major for
   breaking UI changes; the versionCode just adds 1 to the previous.

2. Trigger the release workflow:
   https://github.com/aciderix/CAP2027/actions/workflows/android-release.yml
   → **Run workflow** → fill in `version_name` + `version_code` →
   Run on the `main` branch.

3. Wait ~5 min. The artifact appears at the bottom of the run page
   as `cap2027-release-<version>-<code>` containing
   `app-release.aab`.

4. Download the AAB, upload to the Play Console in the relevant
   release track (Internal → Closed → Open → Production).

5. Submit for review. Internal-testing reviews are usually < 1 hour;
   production reviews can take a few days.

## Troubleshooting

- **"versionCode must be strictly greater than the previous"** — bump
  `version_code` in the workflow input. The Play Store remembers the
  highest code you've ever uploaded.
- **"Signature doesn't match"** — the keystore in
  `ANDROID_KEYSTORE_BASE64` is different from a previous one you used
  on the same app. Use the original. If lost, see "CRITICAL" above.
- **AAB build fails locally on macOS** — the local builds are
  *debug-only*. Production signing only happens in CI. To test signing
  locally, you'd need to set the four `ANDROID_*` env vars yourself.
