# MotoShot GT en iPad (Xcode)

La app iOS carga **https://motoshot.pro** (igual que el APK de Android). Los cambios web se ven sin reinstalar, salvo cambios nativos.

## Requisito en tu Mac (una sola vez)

Si `xcodebuild` dice que solo tienes Command Line Tools, ejecutá en Terminal:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Abrí Xcode una vez y aceptá la licencia si te lo pide.

## Instalar en tu iPad

1. Conectá el iPad por USB (o Wi‑Fi si ya está emparejado en Xcode).
2. En el proyecto:

```bash
cd motoshot-frontend
npm run cap:ios
npm run cap:ios:open
```

3. En Xcode:
   - Proyecto **App** → target **App** → **Signing & Capabilities**
   - Marcá **Automatically manage signing**
   - Elegí tu **Team** (Apple ID personal sirve para pruebas en tu dispositivo)
   - Arriba, seleccioná **tu iPad** como destino (no simulador)
   - Pulsá **Run** (▶)

4. En el iPad: **Ajustes → General → VPN y gestión de dispositivos** → confiá en tu certificado de desarrollador si iOS lo pide.

## Cuenta de MotoShot en el iPad

La app **no comparte sesión con Safari**. Si ya entraste en motoshot.pro en Safari, en la app tendrás que iniciar sesión otra vez (email/contraseña o Google).

## Google en iOS (opcional)

Para **Ingresá con Google** nativo en iOS:

1. Google Cloud → **Credentials** → **Create OAuth client ID** → tipo **iOS**
2. Bundle ID: `com.motoshotgt.app`
3. Copiá el Client ID iOS y agregalo en `.env`:

```
VITE_GOOGLE_IOS_CLIENT_ID=TU_IOS_CLIENT_ID.apps.googleusercontent.com
```

4. En **Info.plist**, agregá el URL scheme (reversed client id). Ejemplo si el client id es `123-abc.apps.googleusercontent.com`, el scheme es `com.googleusercontent.apps.123-abc` — ver documentación de Google Sign-In iOS.

5. `npm run cap:ios` y volvé a correr desde Xcode.

Sin esto, el login con Google en la app iOS no funcionará; email/contraseña sí.

## Búsqueda por foto

En la app nativa se abre la **galería** (`CameraSource.Photos`). Los permisos ya están en `Info.plist`.

## Simulador vs iPad real

- **Simulador:** útil para UI; galería y Google suelen fallar o ser limitados.
- **iPad físico:** la prueba real (recomendado).

## Distribución a otros testers

- Cuenta **Apple Developer** ($99/año) → **TestFlight** o App Store.
- No se puede mandar un IPA por WhatsApp como el APK debug de Android.
