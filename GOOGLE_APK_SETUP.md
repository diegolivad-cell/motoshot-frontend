# Google Login en APK (Android)

El APK usa **Google Sign-In nativo** (sin Chrome / Custom Tab).

## 1. Client ID Web (obligatorio)

En Google Cloud → **APIs & Services → Credentials**, abrí tu cliente **Web application** (el mismo Client ID que pegaste en Supabase → Google).

Copiá el Client ID (termina en `.apps.googleusercontent.com`) y agregalo en:

**`.env` del frontend:**
```
VITE_GOOGLE_WEB_CLIENT_ID=TU_CLIENT_ID.apps.googleusercontent.com
```

**Vercel** → Project → Settings → Environment Variables → mismo nombre `VITE_GOOGLE_WEB_CLIENT_ID` → redeploy.

## 2. Cliente Android en Google Cloud (obligatorio)

1. **Credentials → Create Credentials → OAuth client ID**
2. Tipo: **Android**
3. Package name: `com.motoshotgt.app`
4. SHA-1: obtenelo con Android Studio → Gradle → `signingReport`, o:
   ```bash
   keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
5. Guardar

## 3. Rebuild APK

```bash
cd motoshot-frontend
npm run build
npx cap sync android
cd android
gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## 4. Probar

1. Instalá el APK nuevo
2. Abrí la app → **Ingresá con Google**
3. Debe abrir el selector de cuenta **de Google nativo** (no barra blanca de Chrome)
4. Entrás directo al feed dentro del APK
