import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

const VIEWS = {
  PHOTOGRAPHERS: "photographers",
  PHOTOGRAPHER_PROFILE: "photographer_profile",
  GALLERY: "gallery",
  DETAIL: "detail",
  UPLOAD: "upload",
  SUCCESS: "success",
  AUTH: "auth",
  VENDOR_REQUEST: "vendor_request",
  MY_PURCHASES: "my_purchases",
  NOTIFICATIONS: "notifications",
  ADMIN: "admin",
  DASHBOARD: "dashboard",
  MY_GALLERY: "my_gallery",
};
function WatermarkedImage({ src, photographer, purchased }) {
  const [loaded, setLoaded] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { setImageUrl(src); setLoaded(true); };
    img.src = src;
  }, [src]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      {imageUrl && (
        <img src={imageUrl} alt={photographer}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: loaded ? "block" : "none" }} />
      )}
      {!purchased && loaded && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.72) 100%)" }} />
      )}
      {!purchased && loaded && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ color: "rgba(255,255,255,0.18)", fontSize: 48, fontWeight: 900, textAlign: "center", textTransform: "uppercase", letterSpacing: 3 }}>
            {`© ${photographer} • MOTOSHOT GT`}
          </div>
        </div>
      )}
    </div>
  );
}
//USE STATES
  export default function App() {
  const [view, setView] = useState(VIEWS.PHOTOGRAPHERS);
  const [selected, setSelected] = useState(null);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [purchased, setPurchased] = useState([]);
  const [payStep, setPayStep] = useState(0);
  const [activeTab, setActiveTab] = useState("feed");
  const [searchTerm, setSearchTerm] = useState("");
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });
  const [vendorForm, setVendorForm] = useState({ name: "", handle: "", verification_id: "", bio: "" });
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [vendorStats, setVendorStats] = useState(null);
  const [vendorStatsLoading, setVendorStatsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "", handle: "", phone: "", instagram: "", tiktok: "", facebook: "", telegram: "", whatsapp: "" });
  const [editMode, setEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState("+502");
  const [photographers, setPhotographers] = useState([]);
  const [photographersLoading, setPhotographersLoading] = useState(false);
  const [selectedPhotographer, setSelectedPhotographer] = useState(null);
  const [photographerPhotos, setPhotographerPhotos] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "", image_url: "" });
  const isAdmin = user?.email === "motoshotgt@gmail.com";
  const [showPassword, setShowPassword] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumForm, setAlbumForm] = useState({ name: "", event_date: "" });
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [profileTab, setProfileTab] = useState("medios");
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postForm, setPostForm] = useState({ body: "", image_url: "" });
  const [postLoading, setPostLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState({ active: false, message: "" });
  const showToast = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };
  const [selectedTag, setSelectedTag] = useState(null);
  const [heroScrollY, setHeroScrollY] = useState(0);
  const [photographerSearch, setPhotographerSearch] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState(null);
  const [photoViewMode, setPhotoViewMode] = useState("grid");
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [adminWithdrawals, setAdminWithdrawals] = useState([]);
  
  // ── Upload states ──────────────────────────────────────────
  const [uploadForm, setUploadForm] = useState({ location: "", ride_date: "", price: "", tags: "", time_start: "", time_end: "", album_id: "" });
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});


  // ── Auth ───────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s); setUser(s?.user || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s); setUser(s?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

// ── Fetch photos ───────────────────────────────────────────
const fetchPhotos = async () => {
  try {
    setLoading(true);
    const res = await fetch("/api/photos");
    if (!res.ok) throw new Error("Error cargando fotos");
    const data = await res.json();
    setPhotos(data.photos || []);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

const fetchAllSubscriptions = async () => {
  if (!session) return;
  try {
    setSubsLoading(true);
    const res = await fetch("/api/auth/my-subscriptions/all", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    setAllSubscriptions(data.subscriptions || []);
  } catch (err) {
    console.error(err);
  } finally {
    setSubsLoading(false);
  }
};

const fetchAnnouncements = async () => {
  const res = await fetch("/api/auth/announcements");
  const data = await res.json();
  setAnnouncements(data.announcements || []);
};
useEffect(() => { fetchAnnouncements(); }, []);

// ── Fetch purchases ────────────────────────────────────────
const fetchPurchases = async () => {
  if (!session) return;
  try {
    setPurchasesLoading(true);
    const res = await fetch("/api/payments/my-purchases", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) throw new Error("Error cargando compras");
    const data = await res.json();
    setPurchases(data.purchases || []);
  } catch (err) {
    console.error(err);
    setMessage("No se pudieron cargar tus compras.");
  } finally {
    setPurchasesLoading(false);
  }
};
const fetchNotifications = async () => {
  if (!session) return;
  try {
    setNotifLoading(true);
    const res = await fetch("/api/auth/notifications", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    setNotifications(data.notifications || []);
  } catch (err) {
    console.error(err);
  } finally {
    setNotifLoading(false);
  }
};
const fetchVendorDashboard = async () => {
  if (!session || !user) return;
  try {
    setVendorStatsLoading(true);
    const res = await fetch("/api/auth/vendor-dashboard", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error cargando dashboard");
    setVendorStats(data);
  } catch (err) {
    console.error(err);
    setMessage("No se pudo cargar el dashboard de vendedor.");
  } finally {
    setVendorStatsLoading(false);
  }
};
  const fetchPosts = async (photographerId) => {
  try {
    setPostsLoading(true);
    const res = await fetch(`/api/auth/posts/${photographerId}`);
    const data = await res.json();
    setPosts(data.posts || []);
  } catch (err) {
    console.error(err);
  } finally {
    setPostsLoading(false);
  }
};
const fetchPhotographers = async () => {
  try {
    setPhotographersLoading(true);
    const res = await fetch("/api/auth/photographers");
    const data = await res.json();
    setPhotographers(data.photographers || []);
  } catch (err) {
    console.error(err);
  } finally {
    setPhotographersLoading(false);
  }
};

const fetchAlbums = async (photographerId) => {
  try {
    const res = await fetch(`/api/auth/albums/${photographerId}`);
    const data = await res.json();
    setAlbums(data.albums || []);
  } catch (err) {
    console.error(err);
  }
};

const fetchPhotographerProfile = async (id) => {
  try {
    const [profileRes, albumsRes] = await Promise.all([
      fetch(`/api/auth/photographers/${id}`),
      fetch(`/api/auth/albums/${id}`)
    ]);
    const profileData = await profileRes.json();
    const albumsData = await albumsRes.json();
    
    setSelectedPhotographer(profileData.photographer);
    setPhotographerPhotos(profileData.photos || []);
    setAlbums(albumsData.albums || []);
  } catch (err) {
    console.error(err);
  }
};
const renderNotifications = () => (
  <div className="upload-view">
    <div className="section-title">🔔 NOTIFICACIONES</div>
    <div className="section-sub">Tus ventas y actividad reciente.</div>

    {notifLoading ? (
      <div className="empty"><div className="empty-icon">⏳</div><div>Cargando...</div></div>
    ) : notifications.length === 0 ? (
      <div className="empty"><div className="empty-icon">🔕</div><div>No tenés notificaciones aún.</div></div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            padding: 14, borderRadius: 10,
            background: n.read ? "var(--surface)" : "rgba(255,107,0,0.08)",
            border: `1px solid ${n.read ? "var(--border)" : "var(--orange)"}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              💰 Nueva venta — Q{n.amount}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              📍 {n.photo_location}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              👤 {n.buyer_email}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              {new Date(n.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
const handleEditProfile = async () => {
  setEditLoading(true);
  setGlobalLoading({ active: true, message: "Guardando perfil..." });
  try {
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        ...editForm,
        phone: `${phoneCountry}${editForm.phone}`,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setProfile(data.photographer);
    setEditMode(false);
    showToast("Perfil actualizado.")
  } catch (err) {
    setMessage(err.message);
  } finally {
    setEditLoading(false);
    setGlobalLoading({ active: false, message: "" });
  }
};

const handleAvatarUpload = async () => {
  if (!avatarFile) return;
  setAvatarLoading(true);
  setGlobalLoading({ active: true, message: "Subiendo avatar..." });
  try {
    const formData = new FormData();
    formData.append("avatar", avatarFile);
    const res = await fetch("/api/auth/avatar", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setProfile(prev => ({ ...prev, avatar_url: `${data.avatar_url}?t=${Date.now()}` }));
    setAvatarFile(null);
    showToast("Avatar actualizado.")
  } catch (err) {
    setMessage(err.message);
  } finally {
    setAvatarLoading(false);
    setGlobalLoading({ active: false, message: "" });
  }
};
const fetchMyWithdrawals = async () => {
  if (!session) return;
  try {
    setWithdrawalsLoading(true);
    const res = await fetch("/api/auth/withdrawals/my", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    setWithdrawals(data.withdrawals || []);
  } catch (err) {
    console.error(err);
  } finally {
    setWithdrawalsLoading(false);
  }
};

const fetchAdminWithdrawals = async () => {
  if (!session) return;
  try {
    const res = await fetch("/api/auth/withdrawals/admin", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    setAdminWithdrawals(data.withdrawals || []);
  } catch (err) {
    console.error(err);
  }
};

  useEffect(() => { fetchPhotos(); }, []);
  useEffect(() => { fetchPhotographers(); }, []);
  useEffect(() => {
  if (!user || !session) return;
  fetch("/api/auth/my-subscriptions", {
    headers: { Authorization: `Bearer ${session.access_token}` }
  })
    .then(r => r.json())
    .then(d => setMySubscriptions(d.subscriptions || []))
    .catch(console.error);
}, [user, session]);
useEffect(() => {
  const onScroll = () => setHeroScrollY(window.scrollY);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}, []);
  // ── Fetch profile ──────────────────────────────────────────
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${session?.access_token}` } })
      .then(r => r.json())
      .then(d => setProfile(d.photographer || null))
      .catch(console.error);
  }, [user, session]);
  
  useEffect(() => {
  if (view === VIEWS.MY_PURCHASES && user && session) {
    fetchPurchases();
  }
  }, [view, user, session]);

  useEffect(() => {
    const isApproved = profile?.verification_status === "approved";
    const needsStats = (view === VIEWS.DASHBOARD || view === VIEWS.VENDOR_REQUEST) && isApproved && session && user;
    if (needsStats) 
      fetchVendorDashboard();
      fetchMyWithdrawals();
    // Perfil propio del fotógrafo — cargar sus fotos y álbumes
    if (view === VIEWS.VENDOR_REQUEST && isApproved && profile?.id) {
      fetchPhotographerProfile(profile.id);
      fetchPosts(profile.id);
    }
  
    // Mi Galería — comprador: cargar compras
    if (view === VIEWS.MY_GALLERY && !isApproved && user && session) {
      fetchPurchases();
    }
  }, [view, profile, session, user]);

  useEffect(() => {
    if (view !== VIEWS.VENDOR_REQUEST && editMode) {
      setEditMode(false);
      showToast("Saliste sin guardar los cambios.");
    }
  }, [view]);

  // ── Pending purchase after login ───────────────────────────
  useEffect(() => {
    if (user && pendingPurchase) {
      setSelected(pendingPurchase);
      setPayStep(1);
      setPendingPurchase(null);
      setView(VIEWS.GALLERY);
    }
  }, [user, pendingPurchase]);

  // ── PayPal return ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id") || params.get("token");
    const photoId = params.get("photo_id");

    if (params.get("paypal_return") && orderId && photoId && session) {
      setPayStep(2);
      fetch("/api/payments/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ order_id: orderId, photo_id: photoId }),
      })
        .then(r => { if (!r.ok) throw new Error("Error"); return r.json(); })
        .then(() => {
          setPurchased(prev => [...new Set([...prev, photoId])]);
          setView(VIEWS.SUCCESS);
          setPayStep(0);
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(() => { setMessage("No se pudo completar el pago. Intentá de nuevo."); setPayStep(1); });
    }
    if (params.get("paypal_cancel")) {
      setMessage("Pago cancelado.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [session]);

  const filteredPhotos = photos.filter(p => {
  if (searchTerm === "") return true;
  const term = searchTerm.toLowerCase();
  return (
    (p.photographer?.name || "").toLowerCase().includes(term) ||
    (p.location || "").toLowerCase().includes(term) ||
    (p.tags && p.tags.some(t => t.toLowerCase().includes(term)))
  );
  });

  // ── Handlers ───────────────────────────────────────────────
  const handleBuy = (photo) => {
    if (!user) { setPendingPurchase(photo); setMessage(""); setView(VIEWS.AUTH); return; }
    setSelected(photo); setPayStep(1);
  };

  const handlePayment = async () => {
    if (!selected) return;
    setPayStep(2);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          photo_id: selected.id,
          return_url: `${window.location.origin}/?paypal_return=true&photo_id=${selected.id}`,
          cancel_url: `${window.location.origin}/?paypal_cancel=true&photo_id=${selected.id}`,
        }),
      });
      if (!res.ok) throw new Error("Error creando orden");
      const data = await res.json();
      window.location.href = data.approve_url;
    } catch (err) {
      console.error(err); setPayStep(1); setMessage("No se pudo iniciar el pago.");
    }
  };

  const handleDownload = async () => {
    if (!selected) return;
    if (!user || !session) {
      setPendingPurchase(selected);
      setMessage("");
      setView(VIEWS.AUTH);
      return;
    }
    try {
      const res = await fetch(`/api/downloads/${selected.id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Error descargando");
      const data = await res.json();
      window.open(data.download_url, "_blank");
    } catch (err) {
      console.error(err); setMessage("Error al descargar.");
    }
    setView(VIEWS.SUCCESS); setPayStep(0);
  };

  const handleLogin = async () => {
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
      if (error) throw error;
      setView(VIEWS.PHOTOGRAPHERS);
    } catch (err) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("invalid login credentials")) {
        showToast("Email o contraseña incorrectos.");
      } else if (msg.toLowerCase().includes("email")) {
        showToast("El email ingresado no existe.");
      } else {
        showToast("Error al iniciar sesión. Intentá de nuevo.");
      }
    }
  };

  const handleSignUp = async () => {
    setMessage("");
    try {
      const { error } = await supabase.auth.signUp({ email: authForm.email, password: authForm.password });
      if (error) throw error;
      // Email de bienvenida
      await fetch("/api/auth/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authForm.email, name: authForm.email.split("@")[0] })
      });
      setMessage("Revisá tu email para confirmar tu cuenta.");
    } catch (err) { setMessage(err.message || "Error al registrar."); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setSession(null); setView(VIEWS.PHOTOGRAPHERS);
  };

  const handleRequestVendor = async () => {
    if (!user) { setView(VIEWS.AUTH); return; }
    try {
      const res = await fetch("/api/auth/request-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(vendorForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setProfile(data.photographer);
      setMessage("Solicitud enviada. Esperá la aprobación.");
      setView(VIEWS.GALLERY);
    } catch (err) { setMessage(err.message); }
  };

  const handleUploadPhoto = async () => {
    if (uploadFiles.length === 0) return setMessage("Seleccioná al menos una foto.");
    if (!uploadForm.location || !uploadForm.ride_date || !uploadForm.price)
      return setMessage("Ubicación, fecha y precio son obligatorios.");
  
    setUploadLoading(true);
    setGlobalLoading({ active: true, message: `Subiendo ${uploadFiles.length} foto(s)...` });
    setMessage("");
  
    const initialProgress = {};
    uploadFiles.forEach(f => { initialProgress[f.file.name] = "pending"; });
  
    const results = await Promise.allSettled(
      uploadFiles.map(async ({ file }) => {
        setUploadProgress(prev => ({ ...prev, [file.name]: "uploading" }));
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("location", uploadForm.location);
        formData.append("ride_date", uploadForm.ride_date);
        formData.append("price", uploadForm.price);
        formData.append("tags", uploadForm.tags);
        formData.append("time_start", uploadForm.time_start || "");
        formData.append("time_end", uploadForm.time_end || "");
        formData.append("album_id", uploadForm.album_id || "");
  
        const res = await fetch("/api/photos/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        setUploadProgress(prev => ({ ...prev, [file.name]: "done" }));
      })
    );
  
    const failed = results.filter(r => r.status === "rejected").length;
    const succeeded = results.filter(r => r.status === "fulfilled").length;
  
    if (succeeded > 0) {
      showToast("✓ Fotos publicadas exitosamente.");
      fetchPhotos();
      setTimeout(() => {
        setUploadFiles([]);
        setUploadProgress({});
        setUploadForm({ location: "", ride_date: "", price: "", tags: "", time_start: "", time_end: "", album_id: "" });
      }, 3000);
    }
    if (failed > 0) setMessage(`${failed} foto(s) no se pudieron subir.`);
    setUploadLoading(false);
    setGlobalLoading({ active: false, message: "" });
  };

  // ── Renders ────────────────────────────────────────────────
  const renderHero = () => (
    <div className="hero">
      <div className="hero-title">MOTO<span>SHOT</span> GT</div>
      <div className="hero-sub">Comprá fotos de rodada con PayPal · Alta resolución garantizada</div>
      {user ? (
        <div style={{ marginTop: 12, color: "var(--text)", display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", fontSize: 14 }}>
          <span>Bienvenido, {profile?.name || user.email}</span>
        </div>
      ) : (
        <div style={{ marginTop: 12, color: "var(--muted)" }}>Iniciá sesión para comprar fotos.</div>
      )}
    </div>
  );

  const renderGallery = () => (
    <div>
      {renderHero()}
        <div className="search-bar">
         <input
      className="search-input"
      placeholder="Buscar por fotógrafo, ubicación o marca (ej: Kawasaki)..."
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
         />
      </div>
      {loading ? (
        <div className="empty"><div className="empty-icon">⏳</div><div>Cargando fotos...</div></div>
      ) : filteredPhotos.length === 0 ? (
        <div className="empty"><div className="empty-icon">📸</div><div>No hay fotos disponibles</div></div>
      ) : (
        <div className="grid">
          {filteredPhotos.map(photo => (
            <div key={photo.id} className="card" onClick={() => { setSelected(photo); setView(VIEWS.DETAIL); }}>
              {purchased.includes(photo.id) && <div className="card-bought-badge">✓ Comprada</div>}
              {user && photo.photographer?.user_id === user?.id && (
            <button
            style={{
              position: "absolute", top: 10, right: 10, zIndex: 6,
              background: "rgba(220,50,50,0.85)", border: "none",
              color: "#fff", borderRadius: 6, padding: "4px 10px",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
    }}
              onClick={async e => {
              e.stopPropagation();
      if (!confirm("¿Eliminar esta foto?")) return;
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          if (res.ok) fetchPhotos();
          }}
         >
            🗑️ Eliminar
            </button>
              )}
              <div className="card-photo-badge">{photo.photographer?.name || "MOTOSHOT"}</div>
              <WatermarkedImage src={photo.watermark_url} photographer={photo.photographer?.name || "MOTOSHOT"} purchased={purchased.includes(photo.id)} />
              <div className="card-overlay">
                <div className="card-photographer">{photo.photographer?.name || "MOTOSHOT"}</div>
                <div className="card-location">📍 {photo.location}</div>
            <div className="card-footer">
            <div className="card-price">Q{photo.price}</div>
            { !purchased.includes(photo.id) && photo.photographer?.user_id !== user?.id ? (
            <motion.button>
            className="card-buy"
            onClick={e => { e.stopPropagation(); handleBuy(photo); }}
            
            Comprar
          </motion.button>
  ) : (
    <motion.button>
      className="card-buy"
      style={{ background: "#3ddc84", color: "#000" }}
      onClick={e => {
        e.stopPropagation();
        setSelected(photo);
        setView(VIEWS.SUCCESS);
      }}
    
      ↓ Descargar
    </motion.button>
  )}
              </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  const renderAdmin = () => (
  <div className="upload-view">
    <div className="section-title">⚙️ PANEL ADMIN</div>
    <div className="section-sub">Solo visible para administradores.</div>

    {/* Anuncios */}
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, marginBottom: 12 }}>ANUNCIOS GLOBALES</div>

    <div className="form-group">
      <label className="form-label">Título</label>
      <input className="form-input" value={announcementForm.title}
        onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
        placeholder="Ej: ¡Nuevo fotógrafo verificado!" />
    </div>
    <div className="form-group">
      <label className="form-label">Mensaje</label>
      <input className="form-input" value={announcementForm.body}
        onChange={e => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
        placeholder="Descripción del anuncio..." />
    </div>
    <div className="form-group">
      <label className="form-label">URL de imagen (opcional)</label>
      <input className="form-input" value={announcementForm.image_url}
        onChange={e => setAnnouncementForm({ ...announcementForm, image_url: e.target.value })}
        placeholder="https://..." />
    </div>
    <button className="upload-btn" style={{ marginBottom: 24 }} onClick={async () => {
      const res = await fetch("/api/auth/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(announcementForm),
      });
      if (res.ok) {
        setAnnouncementForm({ title: "", body: "", image_url: "" });
        fetchAnnouncements();
      }
    }}>
      PUBLICAR ANUNCIO
    </button>

    {/* Lista de anuncios activos */}
    {announcements.length > 0 && (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {announcements.map(a => (
          <div key={a.id} style={{ padding: 14, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{a.title}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{a.body}</div>
            <button className="nav-btn" style={{ fontSize: 11, color: "red", borderColor: "red" }}
              onClick={async () => {
                await fetch(`/api/auth/announcements/${a.id}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${session?.access_token}` },
                });
                fetchAnnouncements();
              }}>
              🗑️ Eliminar
            </button>
          </div>
        ))}
      </div>
    )}
  {/* Retiros pendientes */}
<div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, marginBottom: 12 }}>
  SOLICITUDES DE RETIRO
</div>
<button className="nav-btn" style={{ marginBottom: 16, fontSize: 12 }} onClick={fetchAdminWithdrawals}>
  🔄 Cargar solicitudes
</button>
{adminWithdrawals.length === 0 ? (
  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 32 }}>No hay solicitudes aún.</div>
) : (
  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
    {adminWithdrawals.map(w => (
      <div key={w.id} style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: `1px solid ${w.status === "pending" ? "var(--orange)" : "var(--border)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "var(--card)" }}>
              {w.photographer?.avatar_url
                ? <img src={w.photographer.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ display: "grid", placeItems: "center", height: "100%" }}>👤</div>}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{w.photographer?.name}</div>
              <div style={{ fontSize: 12, color: "var(--orange)" }}>{w.photographer?.handle}</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "var(--success)" }}>
            Q{Number(w.amount).toFixed(2)}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {new Date(w.created_at).toLocaleString("es-GT")}
            {w.processed_at && ` · Pagado: ${new Date(w.processed_at).toLocaleDateString("es-GT")}`}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              background: w.status === "paid" ? "rgba(61,220,132,0.12)" : w.status === "pending" ? "rgba(255,107,0,0.12)" : "rgba(100,100,100,0.12)",
              color: w.status === "paid" ? "var(--success)" : w.status === "pending" ? "var(--orange)" : "var(--muted)",
            }}>
              {w.status === "paid" ? "✓ Pagado" : w.status === "pending" ? "⏳ Pendiente" : "Cancelado"}
            </span>
            {w.status === "pending" && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  if (!confirm(`¿Marcar como pagado Q${Number(w.amount).toFixed(2)} a ${w.photographer?.name}?`)) return;
                  const res = await fetch(`/api/auth/withdrawals/${w.id}/pay`, {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${session?.access_token}` }
                  });
                  if (res.ok) { showToast("✓ Marcado como pagado."); fetchAdminWithdrawals(); }
                }}
                style={{ background: "rgba(61,220,132,0.1)", border: "1px solid var(--success)", color: "var(--success)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                ✓ Marcar pagado
              </motion.button>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
)}
    {/* Fotógrafos — destacar */}
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, marginBottom: 12 }}>FOTÓGRAFOS DESTACADOS</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {photographers.map(ph => (
        <div key={ph.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, background: "var(--surface)", border: `1px solid ${ph.featured ? "var(--orange)" : "var(--border)"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "var(--card)" }}>
              {ph.avatar_url ? <img src={ph.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "grid", placeItems: "center", height: "100%" }}>👤</div>}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{ph.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{ph.handle}</div>
            </div>
          </div>
          <button className={`nav-btn${ph.featured ? " primary" : ""}`}
            onClick={async () => {
              const res = await fetch(`/api/auth/photographers/${ph.id}/feature`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
                body: JSON.stringify({ featured: !ph.featured }),
              });
              if (res.ok) fetchPhotographers();
            }}>
            {ph.featured ? "⭐ Destacado" : "Destacar"}
          </button>
        </div>
      ))}
    </div>
  </div>
);
const renderPhotographers = () => (
  <div style={{ paddingBottom: 100 }}>
    {/* Hero */}
    {/* Hero con video */}
{/* Hero con video */}
<div style={{ position: "relative", width: "100%", height: 320, overflow: "hidden" }}>
<video
  autoPlay muted loop playsInline
  style={{
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "130%",
    objectFit: "cover",
    top: "-15%",
    transform: `translateY(${heroScrollY * 0.5}px)`,
    willChange: "transform",
  }}
  src="https://ejkxoaalhrzbyudwxwei.supabase.co/storage/v1/object/public/Video-Hero/14022738_720_1280_60fps.mp4"
/>
  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.65) 100%)" }} />
  <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", textAlign: "center" }}>
    
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(42px, 8vw, 76px)", letterSpacing: 4, lineHeight: 1, color: "#fff" }}
    >
      MOTO<span style={{ color: "var(--orange)" }}>SHOT</span> GT
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, marginTop: 10, fontWeight: 300 }}
    >
      Encontrá al fotógrafo de tu rodada · Comprá tus fotos en alta resolución
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
    >
      {user ? (
        <div style={{ marginTop: 12, color: "#fff", fontSize: 14 }}>
          Bienvenido, {profile?.name || user.email}
        </div>
      ) : (
        <motion.button
          className="nav-btn primary"
          style={{ marginTop: 16 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setView(VIEWS.AUTH)}
        >
          Iniciá sesión para comprar fotos
        </motion.button>
      )}
    </motion.div>

  </div>
</div>

    {/* Anuncios */}
    {announcements.length > 0 && (
      <div style={{ padding: "16px 20px 0" }}>
        {announcements.map(a => (
          <div key={a.id} style={{
            background: "linear-gradient(135deg, rgba(255,107,0,0.12), rgba(255,107,0,0.04))",
            border: "1px solid var(--orange)", borderRadius: 12,
            padding: "14px 16px", marginBottom: 10,
            display: "flex", gap: 12, alignItems: "flex-start"
          }}>
            <span style={{ fontSize: 20 }}>📢</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--orange)", marginBottom: 4 }}>{a.title}</div>
              {a.body && <div style={{ fontSize: 13, color: "var(--muted)" }}>{a.body}</div>}
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Suscripciones activas */}
    {user && mySubscriptions.length > 0 && (
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 12 }}>
          ⭐ TUS SUSCRIPCIONES
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 8 }}>
          {mySubscriptions.map(sub => (
            <div key={sub.id}
            onClick={() => {
              if (user && sub.photographer.user_id === user.id) {
                setView(VIEWS.VENDOR_REQUEST);
                setActiveTab("profile");
              } else {
                fetchPhotographerProfile(sub.photographer.id);
                setView(VIEWS.PHOTOGRAPHER_PROFILE);
              }
            }}
              style={{ flexShrink: 0, width: 120, cursor: "pointer", textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid var(--orange)", background: "var(--card)", margin: "0 auto 8px" }}>
                {sub.photographer.avatar_url
                  ? <img src={sub.photographer.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 24 }}>👤</div>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{sub.photographer.name}</div>
              <div style={{ fontSize: 11, color: "var(--orange)" }}>{sub.photographer.handle}</div>
              <div style={{ fontSize: 10, color: "var(--success)", marginTop: 2 }}>✓ Suscrito</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Fotógrafos destacados */}
{photographers.filter(p => p.featured).length > 0 && (
  <div style={{ padding: "24px 20px 0" }}>
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 4 }}>
      DESTACADOS DE LA SEMANA
    </div>
    <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>Seleccionados por MotoShot GT</div>
    <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 8 }}>
      {photographers.filter(p => p.featured).map(ph => (
        <div key={ph.id}
        onClick={() => {
          if (user && ph.user_id === user.id) {
            setView(VIEWS.VENDOR_REQUEST);
            setActiveTab("profile");
          } else {
            fetchPhotographerProfile(ph.id);
            setView(VIEWS.PHOTOGRAPHER_PROFILE);
          }
        }}
          style={{ flexShrink: 0, width: 160, borderRadius: 12, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--orange)", cursor: "pointer" }}>
          <div style={{ height: 80, background: ph.banner_url ? "none" : "linear-gradient(135deg, #1a1a1a, #2a2a2a)", overflow: "hidden", position: "relative" }}>
            {ph.banner_url
              ? <img src={ph.banner_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--orange)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, opacity: 0.4 }}>MOTOSHOT</div>}
            <div style={{ position: "absolute", top: 6, right: 6, background: "var(--orange)", borderRadius: 10, padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#fff" }}>⭐ DESTACADO</div>
          </div>
          <div style={{ padding: "0 10px 10px", position: "relative" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--orange)", background: "var(--card)", marginTop: -20, marginBottom: 6 }}>
              {ph.avatar_url
                ? <img src={ph.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 16 }}>👤</div>}
            </div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{ph.name}</div>
            <div style={{ color: "var(--orange)", fontSize: 11 }}>{ph.handle}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span>📸 {(ph.photos_count || 0) > 99 ? "+99" : (ph.photos_count || 0)} foto{ph.photos_count !== 1 ? "s" : ""}</span>
              {(ph.albums_count || 0) > 0 && (
                <span>🗂️ {ph.albums_count} álbum{ph.albums_count !== 1 ? "es" : ""}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

    {/* Todos los fotógrafos */}
    <div style={{ padding: "24px 20px 0" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 4 }}>
        FOTÓGRAFOS VERIFICADOS
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>Seleccioná un fotógrafo para ver su galería</div>
      
  {/* Barra de búsqueda */}
<div style={{ position: "relative", marginBottom: 16, display: "flex", gap: 8 }}>
  <div style={{ position: "relative", flex: 1 }}>
    <input
      className="search-input"
      placeholder="Buscar fotógrafo"
      value={photographerSearch}
      onChange={e => { 
        setPhotographerSearch(e.target.value); 
        if (!e.target.value) setSearchMode(false);
      }}
      onKeyDown={e => { if (e.key === "Enter" && photographerSearch.trim()) setSearchMode(true); }}
    />
    {photographerSearch && (
      <button
      onClick={() => { setPhotographerSearch(""); setSearchMode(false); }}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}
      >
        ×
      </button>
    )}
  </div>
  <button
    className="nav-btn primary"
    style={{ flexShrink: 0, padding: "0 20px" }}
    onClick={() => {}}
  >
    Buscar
  </button>
</div>
    {/* Resultados de búsqueda */}
{searchMode && (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        Resultados para <strong style={{ color: "var(--text)" }}>"{photographerSearch}"</strong>
      </div>
      <button onClick={() => { setSearchMode(false); setPhotographerSearch(""); }}
        style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}>
        ✕ Limpiar
      </button>
    </div>

    {photographers.filter(ph => {
      const term = photographerSearch.toLowerCase();
      return (ph.name || "").toLowerCase().includes(term) || (ph.handle || "").toLowerCase().includes(term);
    }).length === 0 ? (
      <div className="empty">
        <div className="empty-icon">🔍</div>
        <div>No se encontró ningún fotógrafo con ese nombre.</div>
      </div>
    ) : (
      photographers.filter(ph => {
        const term = photographerSearch.toLowerCase();
        return (ph.name || "").toLowerCase().includes(term) || (ph.handle || "").toLowerCase().includes(term);
      }).map(ph => (
        <div key={ph.id}
        onClick={() => {
          if (user && ph.user_id === user.id) {
            setView(VIEWS.VENDOR_REQUEST);
            setActiveTab("profile");
          } else {
            fetchPhotographerProfile(ph.id);
            setView(VIEWS.PHOTOGRAPHER_PROFILE);
          }
        }}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 10, cursor: "pointer" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--orange)", background: "var(--card)", flexShrink: 0 }}>
            {ph.avatar_url
              ? <img src={ph.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 20 }}>👤</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{ph.name}</div>
            <div style={{ color: "var(--orange)", fontSize: 13 }}>{ph.handle}</div>
            {ph.bio && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{ph.bio}</div>}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 20 }}>→</div>
        </div>
      ))
    )}
  </div>
)}
      {photographersLoading ? (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
    {[1,2,3,4,5,6].map(i => (
      <motion.div
        key={i}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
        style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div style={{ width: "100%", height: 110, background: "var(--card)" }} />
        <div style={{ padding: "0 14px 14px", position: "relative" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--card)", marginTop: -26, marginBottom: 8, border: "3px solid var(--border)" }} />
          <div style={{ height: 14, width: "60%", background: "var(--card)", borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 11, width: "40%", background: "var(--card)", borderRadius: 6, marginBottom: 12 }} />
          <div style={{ height: 10, width: "80%", background: "var(--card)", borderRadius: 6 }} />
        </div>
      </motion.div>
    ))}
  </div>
) : photographers.length === 0 ? (
        <div className="empty"><div className="empty-icon">📸</div><div>No hay fotógrafos verificados aún.</div></div>
      ) : (
        <motion.div
  style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}
  variants={{
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } }
  }}
  initial="hidden"
  animate="show"
>
{photographers
  .filter(ph => {
    if (!photographerSearch) return true;
    const term = photographerSearch.toLowerCase();
    return (
      (ph.name || "").toLowerCase().includes(term) ||
      (ph.handle || "").toLowerCase().includes(term)
    );
  })
  .map(ph => (
    <motion.div
      key={ph.id}
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
      }}
      whileHover={{ y: -4, borderColor: "var(--orange)" }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        if (user && ph.user_id === user.id) {
          setView(VIEWS.VENDOR_REQUEST);
          setActiveTab("profile");
        } else {
          fetchPhotographerProfile(ph.id);
          setView(VIEWS.PHOTOGRAPHER_PROFILE);
        }
      }}
      style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: `1px solid ${ph.featured ? "var(--orange)" : "var(--border)"}`, cursor: "pointer" }}
    >
      <div style={{ width: "100%", height: 110, background: ph.banner_url ? "none" : "linear-gradient(135deg, #1a1a1a, #2a2a2a)", overflow: "hidden", position: "relative" }}>
        {ph.banner_url
          ? <img src={ph.banner_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--orange)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, opacity: 0.3 }}>MOTOSHOT</div>}
        {ph.featured && <div style={{ position: "absolute", top: 8, right: 8, background: "var(--orange)", borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "#fff" }}>⭐ DESTACADO</div>}
      </div>
      <div style={{ padding: "0 14px 14px", position: "relative" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", border: "3px solid var(--orange)", background: "var(--card)", marginTop: -26, marginBottom: 8 }}>
          {ph.avatar_url
            ? <img src={ph.avatar_url} alt={ph.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 20 }}>👤</div>}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{ph.name}</div>
        <div style={{ color: "var(--orange)", fontSize: 12, marginBottom: 6 }}>{ph.handle || ""}</div>
        {ph.bio && <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8, lineHeight: 1.4 }}>{ph.bio}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span>📸 {(ph.photos_count || 0) > 99 ? "+99" : (ph.photos_count || 0)} foto{ph.photos_count !== 1 ? "s" : ""}</span>
            {(ph.albums_count || 0) > 0 && (
              <span>🗂️ {ph.albums_count} álbum{ph.albums_count !== 1 ? "es" : ""}</span>
            )}
          </div>
          {ph.subscription_price
            ? <div style={{ background: "var(--orange)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>Sub Q{ph.subscription_price}/mes</div>
            : <div style={{ color: "var(--success)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid var(--success)" }}>Fotos sueltas</div>}
        </div>
      </div>
    </motion.div>
  ))}
</motion.div>
      )}
    </div>
  </div>
);
const renderPhotographerProfile = () => (
  <div style={{ paddingBottom: 100 }}>
    {/* Banner */}
    <div style={{ width: "100%", height: 200, background: selectedPhotographer?.banner_url ? "none" : "linear-gradient(135deg, #1a1a1a, #ff6b0022)", overflow: "hidden", position: "relative" }}>
      {selectedPhotographer?.banner_url
        ? <img src={selectedPhotographer.banner_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--orange)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, letterSpacing: 4, opacity: 0.2 }}>MOTOSHOT GT</div>
      }
      <button className="nav-btn" style={{ position: "absolute", top: 12, left: 12 }}
        onClick={() => setView(VIEWS.PHOTOGRAPHERS)}>← Volver</button>
    </div>

    {/* Perfil info */}
    <div style={{ padding: "0 20px", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: -36, marginBottom: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid var(--orange)", background: "var(--card)" }}>
          {selectedPhotographer?.avatar_url
            ? <img src={selectedPhotographer.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 28 }}>👤</div>
          }
        </div>
{selectedPhotographer?.subscription_price && user?.id !== selectedPhotographer?.user_id && (
  <motion.button
    className="nav-btn primary"
    whileHover={{ scale: 1.04 }}
    whileTap={{ scale: 0.95 }}
    onClick={() => {
      if (!user) { setView(VIEWS.AUTH); return; }
      setShowSubscribeModal(true);
    }}
  >
    Suscribirse · Q{selectedPhotographer.subscription_price}/mes
  </motion.button>
)}
</div>

      <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: "easeOut" }}
  style={{ fontWeight: 700, fontSize: 20, marginBottom: 2, textAlign: "center" }}
>
  {selectedPhotographer?.name}
</motion.div>

<motion.div
  initial={{ opacity: 0, y: 15 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
  style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, justifyContent: "center" }}
>
  <div style={{ color: "var(--orange)", fontSize: 13 }}>{selectedPhotographer?.handle}</div>
  <span style={{ display: "inline-flex", width: 16, height: 16, borderRadius: "50%", background: "#0095f6", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, flexShrink: 0 }}>✓</span>
</motion.div>

{selectedPhotographer?.bio && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
    style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}
  >
    {selectedPhotographer.bio}
  </motion.div>
)}

      {selectedPhotographer?.subscription_benefits?.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Beneficios de suscripción</div>
          {selectedPhotographer.subscription_benefits.map((b, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>✓ {b}</div>
          ))}
        </div>
      )}

      {/* Búsqueda dentro del perfil */}
      <input className="search-input" style={{ marginBottom: 16 }}
        placeholder="Buscar fotos por ubicación o marca..."
        onChange={e => {
          const term = e.target.value.toLowerCase();
          // filtrar photographerPhotos localmente
        }} />

      {/* Álbumes */}
      {albums.length > 0 && (
  <div style={{ marginBottom: 24 }}>
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 12 }}>
      ÁLBUMES
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
    {albums.map(album => {
  const albumPhotos = photographerPhotos.filter(p => p.album_id === album.id);
  const isSelected = selectedAlbum?.id === album.id;
  const coverUrl = album.cover_url 
  ? album.cover_url.trim().split("?")[0] + `?t=${album.id}` 
  : albumPhotos[0]?.watermark_url;


  return (
    <motion.div
      key={album.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
      }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { setSelectedAlbum(isSelected ? null : album); setSelectedTag(null); }}
      style={{ borderRadius: 12, overflow: "hidden", background: "var(--surface)", border: `1px solid ${isSelected ? "var(--orange)" : "var(--border)"}`, cursor: "pointer" }}
    >
      {/* Collage */}
<div style={{ height: 160, display: "grid", gap: 2, gridTemplateColumns: (!coverUrl && albumPhotos.length >= 3) ? "2fr 1fr" : "1fr", gridTemplateRows: (!coverUrl && albumPhotos.length >= 3) ? "1fr 1fr" : "1fr", background: "var(--card)" }}>
  {coverUrl ? (
    <img src={coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover", gridColumn: "1 / -1", gridRow: "1 / -1" }} />
  ) : albumPhotos.length === 0 ? (
    <div style={{ display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13, gridColumn: "1 / -1" }}>📷 Sin fotos</div>
  ) : albumPhotos.length === 1 ? (
    <img src={albumPhotos[0].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  ) : albumPhotos.length === 2 ? (
    <>
      <img src={albumPhotos[0].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <img src={albumPhotos[1].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </>
  ) : (
    <>
      <img src={albumPhotos[0].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover", gridRow: "1 / 3" }} />
      <img src={albumPhotos[1].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "relative", overflow: "hidden" }}>
        <img src={albumPhotos[2].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {albumPhotos.length > 3 && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff", fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>
            +{albumPhotos.length - 3}
          </div>
        )}
      </div>
    </>
  )}
</div>

      {/* Info */}
      <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            🗂️ {album.name}
            {isSelected && <span style={{ fontSize: 10, background: "var(--orange)", color: "#fff", padding: "1px 6px", borderRadius: 10 }}>Activo</span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {album.event_date ? `📅 ${album.event_date} · ` : ""}{albumPhotos.length} foto{albumPhotos.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ fontSize: 18, color: isSelected ? "var(--orange)" : "var(--muted)", transition: "color 0.2s" }}>
          {isSelected ? "▲" : "▼"}
        </div>
      </div>
    </motion.div>
  );
})}
    </div>
  </div>
)}

{/* Fotos — filtradas por álbum si hay uno seleccionado */}
{/* Tags filtrables — solo cuando hay álbum seleccionado */}
{selectedAlbum && (() => {
  const albumPhotos = photographerPhotos.filter(p => p.album_id === selectedAlbum.id);
  const allTags = [...new Set(albumPhotos.flatMap(p => p.tags || []))].filter(Boolean);
  
  if (allTags.length === 0) return null;
  
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 8, marginBottom: 16 }}>
      <button
        className={`tag${!selectedTag ? " active" : ""}`}
        onClick={() => setSelectedTag(null)}
      >
        Todas
      </button>
      {allTags.map(tag => (
        <button
          key={tag}
          className={`tag${selectedTag === tag ? " active" : ""}`}
          onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
})()}

{/* Fotos — filtradas por álbum y/o tag */}
{(() => {
  let displayPhotos = selectedAlbum
    ? photographerPhotos.filter(p => p.album_id === selectedAlbum.id)
    : photographerPhotos;

  if (selectedTag) {
    displayPhotos = displayPhotos.filter(p => p.tags?.includes(selectedTag));
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>
    {selectedAlbum
      ? `${selectedAlbum.name.toUpperCase()}${selectedTag ? ` · ${selectedTag}` : ""}`
      : "TODAS LAS FOTOS"} · {displayPhotos.length}
  </div>
  <div style={{ display: "flex", gap: 4 }}>
    {[
      { mode: "grid", icon: "⊞" },
      { mode: "feed", icon: "☰" },
    ].map(({ mode, icon }) => (
      <button
        key={mode}
        onClick={() => setPhotoViewMode(mode)}
        style={{
          background: photoViewMode === mode ? "var(--orange)" : "var(--surface)",
          border: `1px solid ${photoViewMode === mode ? "var(--orange)" : "var(--border)"}`,
          color: photoViewMode === mode ? "#fff" : "var(--muted)",
          borderRadius: 8, padding: "6px 10px", cursor: "pointer",
          fontSize: 16, transition: "all 0.2s",
        }}
      >
        {icon}
      </button>
    ))}
  </div>
</div>

<AnimatePresence mode="wait">
  {photoViewMode === "grid" ? (
    <motion.div
      key="grid"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}
    >
      {displayPhotos.map(photo => (
        <motion.div
          key={photo.id}
          whileTap={{ scale: 0.97 }}
          onClick={() => { setSelected(photo); setView(VIEWS.DETAIL); }}
          style={{ aspectRatio: "1", overflow: "hidden", cursor: "pointer", position: "relative", background: "var(--card)" }}
        >
          <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </motion.div>
      ))}
    </motion.div>
  ) : (
    <motion.div
      key="feed"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {displayPhotos.map(photo => (
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.99 }}
          style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", cursor: "pointer" }}
            onClick={() => { setSelected(photo); setView(VIEWS.DETAIL); }}
          >
            <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)" }}>
                  📍 {photo.location}
                </div>
                {photo.ride_date && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    📅 {photo.ride_date}
                    {photo.time_start ? ` · ${photo.time_start}${photo.time_end ? `–${photo.time_end}` : ""}` : ""}
                  </div>
                )}
                {photo.tags?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                    {photo.tags.map(t => (
                      <span key={t} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 11, padding: "2px 8px", borderRadius: 20 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text)" }}>
                  Q{photo.price}
                </div>
                <motion.button
                  className="card-buy"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleBuy(photo)}
                >
                  Comprar
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )}
</AnimatePresence>
    </>
  );
})()}
    </div>
  </div>
);
  const renderDetail = () => (
    <div style={{ padding: "16px 20px 100px", maxWidth: 540, margin: "0 auto" }}>
      <button className="nav-btn" style={{ marginBottom: 16 }} onClick={() => setView(VIEWS.PHOTOGRAPHERS)}>← Volver</button>
      {selected && (
        <>
          <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "4/3", background: "var(--card)", marginBottom: 16 }}>
            <WatermarkedImage src={selected.watermark_url} photographer={selected.photographer?.name || "MOTOSHOT"} purchased={purchased.includes(selected.id)} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ color: "var(--orange)", fontWeight: 700, fontSize: 15 }}>{selected.photographer?.name}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>📍 {selected.location}</div>
              {selected.ride_date && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>📅 {selected.ride_date}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38 }}>Q{selected.price}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Alta resolución</div>
            </div>
          </div>
          {selected.tags && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {selected.tags.map(t => (
                <span key={t} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, padding: "3px 10px", borderRadius: 20 }}>{t}</span>
              ))}
            </div>
          )}
        {!user || (!purchased.includes(selected.id) && selected.photographer?.user_id !== user?.id) ? (
  <button className="pay-btn" onClick={() => handleBuy(selected)}>
    Comprar — Q{selected.price}
  </button>
) : (
  <button className="download-btn" onClick={handleDownload}>
    ↓ Descarga en HD
  </button>
)}

        </>
      )}
    </div>
  );


  const renderDashboard = () => {
    if (!profile || profile.verification_status !== "approved") {
      return (
        <div className="upload-view">
          <div className="section-title">📊 DASHBOARD</div>
          <div className="empty">
            <div className="empty-icon">🔒</div>
            <div>Solo disponible para fotógrafos verificados.</div>
          </div>
        </div>
      );
    }
  
    return (
      <div className="upload-view">
        <div className="section-title">📊 DASHBOARD</div>
        <div className="section-sub">Resumen de tu actividad y ventas.</div>
  
        {vendorStatsLoading || !vendorStats ? (
          <div className="empty"><div className="empty-icon">⏳</div><div>Cargando estadísticas...</div></div>
        ) : (
          <>
            {/* Tarjeta perfil compacta */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 20 }}>👤</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{profile.name}</div>
                <div style={{ color: "var(--orange)", fontSize: 12 }}>{profile.handle}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "rgba(0,149,246,0.12)", border: "1px solid #0095f6", color: "#0095f6", fontSize: 11, fontWeight: 700 }}>
                <span style={{ display: "inline-flex", width: 14, height: 14, borderRadius: "50%", background: "#0095f6", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10 }}>✓</span>
                Verificado
              </span>
            </div>
  
            {/* Stats cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
              {[
                { label: "Fotos", value: vendorStats.stats.photos_count, icon: "📸" },
                { label: "Ventas", value: vendorStats.stats.total_sales, icon: "🛒" },
                { label: "Ingresos", value: `Q${vendorStats.stats.total_amount}`, icon: "💰" },
              ].map(s => (
                <div key={s.label} style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--orange)", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)", letterSpacing: 0.5, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
  
            {/* Ventas por día */}
<div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, marginBottom: 12 }}>VENTAS POR DÍA</div>
{vendorStats.stats.daily_sales.length === 0 ? (
  <div className="empty"><div className="empty-icon">🧾</div><div>Todavía no tenés ventas registradas.</div></div>
) : (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {vendorStats.stats.daily_sales.map(d => (
      <div key={d.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{d.date}</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{d.sales} venta(s)</div>
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--success)" }}>Q{d.amount}</div>
      </div>
    ))}
  </div>
)}

{/* Retiros */}
<div style={{ marginTop: 28 }}>
  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, marginBottom: 12 }}>RETIROS</div>
  {(() => {
    const totalEarned = vendorStats?.stats?.total_amount || 0;
    const totalWithdrawn = withdrawals.filter(w => ["pending","paid"].includes(w.status)).reduce((sum, w) => sum + Number(w.amount || 0), 0);
    const available = totalEarned - totalWithdrawn;
    const hasPending = withdrawals.some(w => w.status === "pending");
    return (
      <>
        <div style={{ padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Balance disponible</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: available >= 50 ? "var(--success)" : "var(--muted)", lineHeight: 1, marginTop: 4 }}>
              Q{available.toFixed(2)}
            </div>
            {available < 50 && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Mínimo Q50 para retirar</div>}
          </div>
          {hasPending ? (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--orange)", fontWeight: 700, marginBottom: 8 }}>⏳ Retiro pendiente</div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  const pending = withdrawals.find(w => w.status === "pending");
                  if (!pending || !confirm("¿Cancelar la solicitud de retiro?")) return;
                  const res = await fetch(`/api/auth/withdrawals/${pending.id}/cancel`, {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${session?.access_token}` }
                  });
                  if (res.ok) { showToast("Retiro cancelado."); fetchMyWithdrawals(); }
                }}
                style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.4)", color: "#ff4444", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar retiro
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={available < 50}
              onClick={async () => {
                if (!confirm(`¿Solicitar retiro de Q${available.toFixed(2)}?`)) return;
                const res = await fetch("/api/auth/withdrawals", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${session?.access_token}` }
                });
                const data = await res.json();
                if (res.ok) { showToast("✓ Retiro solicitado. Procesaremos tu pago pronto."); fetchMyWithdrawals(); }
                else showToast(data.error);
              }}
              style={{ background: available >= 50 ? "var(--orange)" : "var(--surface)", border: `1px solid ${available >= 50 ? "var(--orange)" : "var(--border)"}`, color: available >= 50 ? "#fff" : "var(--muted)", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: available >= 50 ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif" }}
            >
              💸 Solicitar retiro
            </motion.button>
          )}
        </div>
        {withdrawals.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Historial</div>
            {withdrawals.map(w => (
              <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Q{Number(w.amount).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{new Date(w.created_at).toLocaleDateString("es-GT")}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: w.status === "paid" ? "rgba(61,220,132,0.12)" : w.status === "pending" ? "rgba(255,107,0,0.12)" : "rgba(100,100,100,0.12)", color: w.status === "paid" ? "var(--success)" : w.status === "pending" ? "var(--orange)" : "var(--muted)", border: `1px solid ${w.status === "paid" ? "var(--success)" : w.status === "pending" ? "var(--orange)" : "var(--border)"}` }}>
                  {w.status === "paid" ? "✓ Pagado" : w.status === "pending" ? "⏳ Pendiente" : "Cancelado"}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  })()}
</div>

          </>
        )}
      </div>
    );
  };
  
  const renderMyGallery = () => {
    const isPhotographer = profile?.verification_status === "approved";
  
    if (isPhotographer) {
      const myPhotos = photos.filter(p => p.photographer?.user_id === user?.id);
      const displayPhotos = selectedAlbum
        ? myPhotos.filter(p => p.album_id === selectedAlbum.id)
        : myPhotos;
  
      const toggleSelect = (id) => {
        setSelectedPhotos(prev => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
      };
  
      const handleDeleteSelected = async () => {
        if (selectedPhotos.size === 0) return;
        if (!confirm(`¿Eliminar ${selectedPhotos.size} foto(s) seleccionada(s)?`)) return;
        await Promise.all([...selectedPhotos].map(id =>
          fetch(`/api/photos/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session?.access_token}` },
          })
        ));
        setSelectedPhotos(new Set());
        setSelectMode(false);
        fetchPhotos();
      };
  
      const handleDeleteAlbum = async (album) => {
        if (!confirm(`¿Eliminar el álbum "${album.name}"? Las fotos no se borran, solo se desvinculan.`)) return;
        const res = await fetch(`/api/auth/albums/${album.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (res.ok) {
          setAlbums(prev => prev.filter(a => a.id !== album.id));
          if (selectedAlbum?.id === album.id) setSelectedAlbum(null);
        } else {
          setMessage("No se pudo eliminar el álbum.");
        }
      };
  
      return (
        <div style={{ paddingBottom: 100 }}>
          {/* Header */}
          <div style={{ padding: "24px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="section-title" style={{ marginBottom: 4 }}>🖼️ MI GALERÍA</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>{myPhotos.length} foto(s) publicadas</div>
            </div>
            <button
              className={`nav-btn${selectMode ? " primary" : ""}`}
              onClick={() => { setSelectMode(!selectMode); setSelectedPhotos(new Set()); }}
            >
              {selectMode ? "Cancelar" : "✂️ Seleccionar"}
            </button>
          </div>
  
          {/* Barra de acciones al seleccionar */}
          {selectMode && (
            <div style={{ margin: "12px 20px 0", padding: "12px 16px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {selectedPhotos.size > 0
                  ? <><span style={{ color: "var(--text)", fontWeight: 700 }}>{selectedPhotos.size}</span> seleccionada(s)</>
                  : "Tocá las fotos para seleccionar"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="nav-btn" style={{ fontSize: 12 }}
                  onClick={() => {
                    if (selectedPhotos.size === displayPhotos.length) {
                      setSelectedPhotos(new Set());
                    } else {
                      setSelectedPhotos(new Set(displayPhotos.map(p => p.id)));
                    }
                  }}>
                  {selectedPhotos.size === displayPhotos.length ? "Deseleccionar todo" : "Seleccionar todo"}
                </button>
                <button
                  className="nav-btn"
                  style={{ fontSize: 12, background: selectedPhotos.size > 0 ? "rgba(220,50,50,0.15)" : "none", borderColor: selectedPhotos.size > 0 ? "rgba(220,50,50,0.6)" : "var(--border)", color: selectedPhotos.size > 0 ? "#ff4444" : "var(--muted)" }}
                  disabled={selectedPhotos.size === 0}
                  onClick={handleDeleteSelected}
                >
                  🗑️ Eliminar ({selectedPhotos.size})
                </button>
              </div>
            </div>
          )}
  
          {/* Filtro por álbum */}
          {albums.length > 0 && (
            <div style={{ padding: "16px 20px 0", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", flexWrap: "nowrap" }}>
              <button
                className={`tag${!selectedAlbum ? " active" : ""}`}
                onClick={() => setSelectedAlbum(null)}
              >
                Todas ({myPhotos.length})
              </button>
              {albums.map(album => {
                const count = myPhotos.filter(p => p.album_id === album.id).length;
                const isActive = selectedAlbum?.id === album.id;
                return (
                  <div key={album.id} style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
                    <button
                      className={`tag${isActive ? " active" : ""}`}
                      style={{ borderRadius: "20px 0 0 20px", borderRight: "none" }}
                      onClick={() => setSelectedAlbum(isActive ? null : album)}
                    >
                      {album.name} ({count})
                    </button>
                    <button
                      onClick={() => handleDeleteAlbum(album)}
                      style={{ padding: "6px 10px", borderRadius: "0 20px 20px 0", border: `1px solid ${isActive ? "var(--orange)" : "var(--border)"}`, background: isActive ? "var(--orange)" : "var(--surface)", color: isActive ? "#fff" : "var(--muted)", cursor: "pointer", fontSize: 12, transition: "all 0.2s" }}
                      title="Eliminar álbum"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
  
          {/* Grid */}
{displayPhotos.length === 0 ? (
  <div className="empty">
    <div className="empty-icon">📷</div>
    <div>{myPhotos.length === 0 ? "Todavía no subiste fotos." : "No hay fotos en este álbum."}</div>
    {myPhotos.length === 0 && (
      <button className="nav-btn primary" style={{ marginTop: 16 }}
        onClick={() => { setActiveTab("upload"); setView(VIEWS.UPLOAD); }}>
        Subir primera foto
      </button>
    )}
  </div>
) : (
  <>
    {/* Toggle de vista */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", marginTop: 16, marginBottom: 8 }}>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>{displayPhotos.length} foto(s)</div>
      <div style={{ display: "flex", gap: 4 }}>
        {[{ mode: "grid", icon: "⊞" }, { mode: "feed", icon: "☰" }].map(({ mode, icon }) => (
          <button
            key={mode}
            onClick={() => setPhotoViewMode(mode)}
            style={{
              background: photoViewMode === mode ? "var(--orange)" : "var(--surface)",
              border: `1px solid ${photoViewMode === mode ? "var(--orange)" : "var(--border)"}`,
              color: photoViewMode === mode ? "#fff" : "var(--muted)",
              borderRadius: 8, padding: "6px 10px", cursor: "pointer",
              fontSize: 16, transition: "all 0.2s",
            }}
          >{icon}</button>
        ))}
      </div>
    </div>

    {photoViewMode === "grid" ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
        {displayPhotos.map(photo => {
          const isSelected = selectedPhotos.has(photo.id);
          const albumName = photo.album_id ? albums.find(a => a.id === photo.album_id)?.name : null;
          return (
            <div
              key={photo.id}
              onClick={() => selectMode ? toggleSelect(photo.id) : null}
              style={{ aspectRatio: "1", overflow: "hidden", position: "relative", background: "var(--card)", outline: isSelected ? "3px solid var(--orange)" : "none", outlineOffset: -3, cursor: selectMode ? "pointer" : "default" }}
            >
              {selectMode && (
                <div style={{ position: "absolute", top: 6, left: 6, zIndex: 10, width: 20, height: 20, borderRadius: 5, border: `2px solid ${isSelected ? "var(--orange)" : "rgba(255,255,255,0.7)"}`, background: isSelected ? "var(--orange)" : "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", fontSize: 12, color: "#fff", transition: "all 0.15s" }}>
                  {isSelected ? "✓" : ""}
                </div>
              )}
              {!selectMode && (
                <button
                  style={{ position: "absolute", top: 6, right: 6, zIndex: 6, background: "rgba(220,50,50,0.85)", border: "none", color: "#fff", borderRadius: 6, padding: "3px 7px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                  onClick={async e => {
                    e.stopPropagation();
                    if (!confirm("¿Eliminar esta foto?")) return;
                    const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session?.access_token}` } });
                    if (res.ok) fetchPhotos();
                  }}
                >🗑️</button>
              )}
              <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 20px" }}>
        {displayPhotos.map(photo => {
          const isSelected = selectedPhotos.has(photo.id);
          const albumName = photo.album_id ? albums.find(a => a.id === photo.album_id)?.name : null;
          return (
            <div
              key={photo.id}
              style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: `1px solid ${isSelected ? "var(--orange)" : "var(--border)"}`, cursor: selectMode ? "pointer" : "default" }}
              onClick={() => selectMode ? toggleSelect(photo.id) : null}
            >
              <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", position: "relative" }}>
                {selectMode && (
                  <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, width: 24, height: 24, borderRadius: 6, border: `2px solid ${isSelected ? "var(--orange)" : "rgba(255,255,255,0.7)"}`, background: isSelected ? "var(--orange)" : "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", fontSize: 14, color: "#fff" }}>
                    {isSelected ? "✓" : ""}
                  </div>
                )}
                {!selectMode && (
                  <button
                    style={{ position: "absolute", top: 10, right: 10, zIndex: 6, background: "rgba(220,50,50,0.85)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    onClick={async e => {
                      e.stopPropagation();
                      if (!confirm("¿Eliminar esta foto?")) return;
                      const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session?.access_token}` } });
                      if (res.ok) fetchPhotos();
                    }}
                  >🗑️</button>
                )}
                <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {albumName && <div style={{ fontSize: 11, color: "var(--orange)", marginBottom: 2 }}>🗂️ {albumName}</div>}
                    <div style={{ fontSize: 13, fontWeight: 700 }}>📍 {photo.location}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {photo.ride_date || ""}
                      {photo.time_start ? ` · ${photo.time_start}${photo.time_end ? `–${photo.time_end}` : ""}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "var(--text)" }}>Q{photo.price}</div>
                    <div style={{ fontSize: 10, background: "var(--success)", color: "#000", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>✓ Publicada</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>
)}
      </div>
    );
  }
  
    // ── COMPRADOR ──────────────────────────────────────────────────
    return (
      <div style={{ paddingBottom: 100 }}>
        <div className="upload-view" style={{ paddingBottom: 0 }}>
          <div className="section-title">🖼️ MIS FOTOS</div>
          <div className="section-sub">Fotos que compraste — tocá para descargar.</div>
        </div>
        {!user ? (
          <div className="empty"><div className="empty-icon">🔒</div><div>Iniciá sesión para ver tus fotos.</div></div>
        ) : purchasesLoading ? (
          <div className="empty"><div className="empty-icon">⏳</div><div>Cargando...</div></div>
        ) : purchases.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🧾</div>
            <div>Todavía no compraste fotos.</div>
            <button className="nav-btn primary" style={{ marginTop: 16 }} onClick={() => { setActiveTab("feed"); setView(VIEWS.PHOTOGRAPHERS); }}>
              Explorar fotógrafos
            </button>
          </div>
        ) : (
          <div className="grid">
            {purchases.map(p => (
              <div key={p.id} className="card"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/downloads/${p.photo.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
                    if (!res.ok) throw new Error();
                    const data = await res.json();
                    window.open(data.download_url, "_blank");
                  } catch { setMessage("Error al descargar."); }
                }}>
                <div className="card-bought-badge">✓ Comprada</div>
                <WatermarkedImage src={p.photo?.watermark_url} photographer={p.photo?.photographer?.name || "MOTOSHOT"} purchased={true} />
                <div className="card-overlay">
                  <div className="card-photographer">{p.photo?.photographer?.name}</div>
                  <div className="card-location">📍 {p.photo?.location}</div>
                  <div className="card-footer">
                    <div className="card-price">Q{p.amount}</div>
                    <div style={{ fontSize: 11, background: "var(--success)", color: "#000", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>↓ Descargar</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderUpload = () => (
  <div className="upload-view">
    <div className="section-title">SUBIR FOTO</div>
    <div className="section-sub">La marca de agua se aplica automáticamente al publicar.</div>

    {!user ? (
      <div className="empty"><div className="empty-icon">🔒</div><div>Iniciá sesión para subir fotos.</div></div>
    ) : !profile ? (
      <div className="empty"><div className="empty-icon">📋</div><div>Necesitás un perfil de fotógrafo aprobado. <br /><button className="nav-btn primary" style={{ marginTop: 12 }} onClick={() => setView(VIEWS.VENDOR_REQUEST)}>Solicitar perfil</button></div></div>
    ) : profile.verification_status !== "approved" ? (
      <div className="empty"><div className="empty-icon">⏳</div><div>Tu perfil está <strong style={{ color: "var(--orange)" }}>{profile.verification_status}</strong>. Esperá la aprobación del administrador.</div></div>
    ) : (
      <>

        <div className="form-group">
          <label className="form-label">Fotos (JPG / PNG / WebP — máx 30MB c/u)</label>
          <div className={`dropzone${uploadFiles.length > 0 ? " active" : ""}`}
            onClick={() => document.getElementById("photo-input").click()}>
            <div className="dropzone-icon">📸</div>
            <div className="dropzone-text">
              {uploadFiles.length > 0
                ? <span style={{ color: "var(--orange)", fontWeight: 700 }}>{uploadFiles.length} foto(s) seleccionada(s)</span>
                : <><span style={{ color: "var(--orange)" }}>Toca para seleccionar</span> una o varias fotos</>}
            </div>
          </div>
          <input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp"
            multiple style={{ display: "none" }}
            onChange={e => {
              const files = Array.from(e.target.files);
              setUploadFiles(files.map(f => ({ file: f, url: URL.createObjectURL(f), tags: "" })));
              setUploadProgress({});
            }} />

          {uploadFiles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, maxHeight: 400, overflowY: "auto" }}>
              {uploadFiles.map(({ file, url, tags }) => {
                const status = uploadProgress[file.name];
                return (
                  <div key={file.name} style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 8 }}>
                    <div style={{ position: "relative", width: 64, height: 64, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                      <img src={url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {status === "uploading" && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", fontSize: 16 }}>⏳</div>}
                      {status === "done" && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", fontSize: 16 }}>✅</div>}
                      {status === "error" && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", fontSize: 16 }}>❌</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                      <input
                        className="form-input"
                        placeholder="Tags: Honda, ZX6R, Domingo..."
                        value={tags}
                        style={{ fontSize: 12, padding: "6px 10px" }}
                        onChange={e => {
                          const val = e.target.value;
                          setUploadFiles(prev => prev.map(item =>
                            item.file.name === file.name ? { ...item, tags: val } : item
                          ));
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Ubicación / Punto de fotografía</label>
          <input className="form-input" placeholder="Ej: Curva del Caminero KM 14"
            value={uploadForm.location} onChange={e => setUploadForm({ ...uploadForm, location: e.target.value })} />
        </div>
      <div className="form-group">
        <label className="form-label">Hora (rango)</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="form-input" type="time"
            value={uploadForm.time_start || ""}
            onChange={e => setUploadForm({ ...uploadForm, time_start: e.target.value })}
            style={{ flex: 1 }} />
    <span style={{ color: "var(--muted)", fontSize: 13 }}>a</span>
    <input className="form-input" type="time"
      value={uploadForm.time_end || ""}
      onChange={e => setUploadForm({ ...uploadForm, time_end: e.target.value })}
      style={{ flex: 1 }} />
  </div>
</div>
          <div className="form-group">
  <label className="form-label">Álbum (opcional)</label>
  <div style={{ display: "flex", gap: 8 }}>
    <select className="form-input"
      value={uploadForm.album_id || ""}
      onChange={e => setUploadForm({ ...uploadForm, album_id: e.target.value })}>
      <option value="">Sin álbum</option>
      {albums.map(a => (
        <option key={a.id} value={a.id}>{a.name} {a.event_date ? `· ${a.event_date}` : ""}</option>
      ))}
    </select>
    <button className="nav-btn" style={{ flexShrink: 0 }} onClick={() => setShowAlbumModal(true)}>
      + Nuevo
    </button>
  </div>
</div>
        <div className="form-group">
          <label className="form-label">Fecha de rodada</label>
          <input className="form-input" type="date"
            value={uploadForm.ride_date} onChange={e => setUploadForm({ ...uploadForm, ride_date: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Precio (Q)</label>
          <input className="form-input" type="number" placeholder="50"
            value={uploadForm.price} onChange={e => setUploadForm({ ...uploadForm, price: e.target.value })} />
        </div>
        <button className="upload-btn" onClick={handleUploadPhoto} disabled={uploadLoading}
          style={{ opacity: uploadLoading ? 0.6 : 1 }}>
          {uploadLoading ? "SUBIENDO..." : `↑ PUBLICAR ${uploadFiles.length > 1 ? uploadFiles.length + " FOTOS" : "FOTO"}`}
        </button>
      </>
    )}
  </div>
);

  const renderMyPurchases = () => (
  <div className="upload-view">
    <div className="section-title">MIS COMPRAS</div>
    <div className="section-sub">Volvé a descargar tus fotos compradas.</div>

    {!user ? (
      <div className="empty">
        <div className="empty-icon">🔒</div>
        <div>Iniciá sesión para ver tu historial de compras.</div>
      </div>
    ) : purchasesLoading ? (
      <div className="empty">
        <div className="empty-icon">⏳</div>
        <div>Cargando compras...</div>
      </div>
    ) : purchases.length === 0 ? (
      <div className="empty">
        <div className="empty-icon">🧾</div>
        <div>Todavía no has comprado fotos.</div>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {purchases.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              gap: 12,
              padding: 12,
              borderRadius: 10,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 80,
                height: 60,
                borderRadius: 8,
                overflow: "hidden",
                background: "var(--card)",
                flexShrink: 0,
              }}
            >
              <img
                src={p.photo?.watermark_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div style={{ flex: 1, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>
                {p.photo?.photographer?.name || "Fotógrafo"}
              </div>
              <div style={{ color: "var(--muted)", marginTop: 2 }}>
                📍 {p.photo?.location}
              </div>
              <div style={{ color: "var(--muted)", marginTop: 2 }}>
                💰 Q{p.amount} ·{" "}
                {p.completed_at
                  ? new Date(p.completed_at).toLocaleString()
                  : "Completado"}
              </div>
            </div>
            <button
              className="card-buy"
              style={{ background: "#3ddc84", color: "#000" }}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/downloads/${p.photo.id}`, {
                    headers: {
                      Authorization: `Bearer ${session.access_token}`,
                    },
                  });
                  if (!res.ok) throw new Error("Error al descargar");
                  const data = await res.json();
                  window.open(data.download_url, "_blank");
                } catch (err) {
                  console.error(err);
                  setMessage("Error al descargar.");
                }
              }}
            >
              ↓ Descargar
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const renderVendorRequest = () => {
  // ── No logueado ────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="upload-view">
        <div className="section-title">👤 PERFIL</div>
        <div className="empty">
          <div className="empty-icon">🔒</div>
          <div>Iniciá sesión para ver tu perfil.</div>
          <button className="nav-btn primary" style={{ marginTop: 16 }} onClick={() => setView(VIEWS.AUTH)}>
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  // ── FOTÓGRAFO APROBADO: su propio perfil público + edición ─────
  if (profile?.verification_status === "approved") {
    // Usa selectedPhotographer (cargado por el useEffect al entrar a esta vista)
    const ph = selectedPhotographer?.user_id === user.id ? selectedPhotographer : null;

    return (
      <div style={{ paddingBottom: 100 }}>
        {/* Banner */}
        <div style={{ width: "100%", height: 180, background: (ph?.banner_url || profile.banner_url) ? "none" : "linear-gradient(135deg, #1a1a1a, #ff6b0022)", overflow: "hidden", position: "relative" }}>
          {(ph?.banner_url || profile.banner_url)
            ? <img src={ph?.banner_url || profile.banner_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--orange)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, opacity: 0.2 }}>MOTOSHOT GT</div>}
        </div>

        {/* Info */}
        <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: -36, marginBottom: 16, position: "relative", zIndex: 2 }}>
  <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid var(--orange)", background: "var(--card)", flexShrink: 0 }}>
    {(ph?.avatar_url || profile.avatar_url)
      ? <img src={ph?.avatar_url || profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 24 }}>👤</div>}
  </div>
  <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
  {profile?.subscription_price && (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => {
        setEditMode(true);
        setTimeout(() => {
          document.getElementById("subscription-section")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }}
      style={{
        background: "linear-gradient(135deg, rgba(255,107,0,0.15), rgba(255,107,0,0.05))",
        border: "1px solid var(--orange)",
        color: "var(--orange)",
        padding: "8px 16px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      💳 Manejar Suscripciónes
    </motion.button>
  )}
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={() => {
      setEditMode(!editMode);
      setEditForm({
        name: profile.name || "",
        bio: profile.bio || "",
        handle: profile.handle || "",
        phone: profile.phone || "",
        instagram: profile.instagram || "",
        tiktok: profile.tiktok || "",
        facebook: profile.facebook || "",
        telegram: profile.telegram || "",
        whatsapp: profile.whatsapp || "",
      });
    }}
    style={{
      background: editMode ? "rgba(255,68,68,0.1)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${editMode ? "rgba(255,68,68,0.5)" : "rgba(255,255,255,0.15)"}`,
      color: editMode ? "#ff4444" : "var(--text)",
      padding: "8px 16px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "'DM Sans', sans-serif",
    }}
  >
    {editMode ? "✕ Cancelar" : "✏️ Editar Perfil"}
  </motion.button>
</div>
</div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 2, textAlign: "center" }}>{profile.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, justifyContent: "center" }}>
                <div style={{ color: "var(--orange)", fontSize: 13 }}>{profile.handle}</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text)", flexShrink: 0 }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              {profile.bio && <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>{profile.bio}</div>}
            {/* Redes sociales — modo lectura */}
{(profile.instagram || profile.tiktok || profile.facebook || profile.telegram || profile.whatsapp) && (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
    {profile.instagram && (
      <a href={`https://instagram.com/${profile.instagram.replace("@","")}`} target="_blank" rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text)", textDecoration: "none" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        {profile.instagram}
      </a>
    )}
    {profile.tiktok && (
      <a href={`https://tiktok.com/${profile.tiktok.replace("@","")}`} target="_blank" rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text)", textDecoration: "none" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.79a4.85 4.85 0 01-1.01-.1z"/></svg>
        {profile.tiktok}
      </a>
    )}
    {profile.facebook && (
      <a href={`https://facebook.com/${profile.facebook}`} target="_blank" rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text)", textDecoration: "none" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Facebook
      </a>
    )}
    {profile.telegram && (
      <a href={`https://t.me/${profile.telegram.replace("@","")}`} target="_blank" rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text)", textDecoration: "none" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        {profile.telegram}
      </a>
    )}
    {profile.whatsapp && (
      <a href={`https://wa.me/${profile.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text)", textDecoration: "none" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp
      </a>
    )}
  </div>
)}

          {/* ── Formulario edición ── */}
          {editMode && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, marginBottom: 16 }}>EDITAR PERFIL</div>

              {/* Avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", background: "var(--card)", border: "2px solid var(--border)", flexShrink: 0 }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 20 }}>👤</div>}
                </div>
                <div>
                  <input type="file" id="avatar-input" accept="image/*" style={{ display: "none" }} onChange={e => setAvatarFile(e.target.files[0] || null)} />
                  <button className="nav-btn" onClick={() => document.getElementById("avatar-input").click()}>
                    {avatarFile ? avatarFile.name : "Cambiar avatar"}
                  </button>
                  {avatarFile && (
                    <button className="nav-btn primary" style={{ marginLeft: 8 }} onClick={handleAvatarUpload} disabled={avatarLoading}>
                      {avatarLoading ? "Subiendo..." : "Guardar"}
                    </button>
                  )}
                </div>
              </div>

              {/* Banner */}
              <div className="form-group">
                <label className="form-label">Banner</label>
                <div style={{ width: "100%", height: 80, borderRadius: 10, overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", marginBottom: 8 }}>
                  {profile.banner_url
                    ? <img src={profile.banner_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12 }}>Sin banner</div>}
                </div>
                <input type="file" id="banner-input" accept="image/*" style={{ display: "none" }}
                  onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    setGlobalLoading({ active: true, message: "Subiendo banner..." });
                    try {
                      const formData = new FormData();
                      formData.append("banner", file);
                      const res = await fetch("/api/auth/banner", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${session?.access_token}` },
                        body: formData,
                      });
                      const data = await res.json();
                      if (res.ok) setProfile(prev => ({ ...prev, banner_url: data.banner_url }));
                      else setMessage(data.error);
                    } finally {
                      setGlobalLoading({ active: false, message: "" });
                    }
                  }}/>
                <button className="nav-btn" onClick={() => document.getElementById("banner-input").click()}>
                  {profile.banner_url ? "Cambiar banner" : "Subir banner"}
                </button>
              </div>

              {/* Watermark logo */}
              <div className="form-group">
                <label className="form-label">Logo de marca de agua</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {profile.watermark_logo_url
                      ? <img src={profile.watermark_logo_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : <span style={{ fontSize: 20 }}>🔒</span>}
                  </div>
                  <div>
                    <input type="file" id="wm-logo-input" accept="image/*" style={{ display: "none" }}
                      onChange={async e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setGlobalLoading({ active: true, message: "Subiendo logo de marca de agua..." });
                        try {
                          const formData = new FormData();
                          formData.append("logo", file);
                          const res = await fetch("/api/auth/watermark-logo", {
                            method: "POST",
                            headers: { Authorization: `Bearer ${session?.access_token}` },
                            body: formData,
                          });
                          const data = await res.json();
                          if (res.ok) setProfile(prev => ({ ...prev, watermark_logo_url: data.watermark_logo_url }));
                          else setMessage(data.error);
                        } finally {
                          setGlobalLoading({ active: false, message: "" });
                        }
                      }} />
                    <button className="nav-btn" onClick={() => document.getElementById("wm-logo-input").click()}>
                      {profile.watermark_logo_url ? "Cambiar logo" : "Subir logo"}
                    </button>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>PNG transparente recomendado</div>
                  </div>
                </div>
              </div>

              {/* Campos texto */}
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="form-group">
    <label className="form-label">Handle</label>
  <div style={{ position: "relative" }}>
    <input 
      className="form-input" 
      value={editForm.handle} 
      onChange={async e => {
        const val = e.target.value;
        setEditForm({ ...editForm, handle: val });
        
        if (val.length < 3) return;
        
        // Verificar disponibilidad
        const res = await fetch(`/api/auth/check-handle?handle=${encodeURIComponent(val)}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        setHandleAvailable(data.available);
      }}
      style={{ paddingRight: 40 }}
    />
    {editForm.handle.length >= 3 && handleAvailable !== null && (
      <span style={{ 
        position: "absolute", right: 12, top: "50%", 
        transform: "translateY(-50%)",
        color: handleAvailable ? "var(--success)" : "#ff4444",
        fontSize: 16
      }}>
        {handleAvailable ? "✓" : "✕"}
      </span>
    )}
  </div>
  {editForm.handle.length >= 3 && handleAvailable === false && (
    <div style={{ fontSize: 12, color: "#ff4444", marginTop: 4 }}>
      Ese usuario no está disponible.
    </div>
  )}
  {editForm.handle.length >= 3 && handleAvailable === true && (
    <div style={{ fontSize: 12, color: "var(--success)", marginTop: 4 }}>
      ¡Disponible!
    </div>
  )}
</div>
              <div className="form-group">
                <label className="form-label">Bio</label>
                <input className="form-input" value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select className="form-input" style={{ width: "auto", flexShrink: 0 }} value={phoneCountry} onChange={e => setPhoneCountry(e.target.value)}>
                    {[
                      { flag: "🇬🇹", name: "Guatemala", code: "+502" },
                      { flag: "🇲🇽", name: "México", code: "+52" },
                      { flag: "🇺🇸", name: "EE.UU.", code: "+1" },
                      { flag: "🇸🇻", name: "El Salvador", code: "+503" },
                      { flag: "🇭🇳", name: "Honduras", code: "+504" },
                      { flag: "🇨🇷", name: "Costa Rica", code: "+506" },
                      { flag: "🇵🇦", name: "Panamá", code: "+507" },
                      { flag: "🇨🇴", name: "Colombia", code: "+57" },
                      { flag: "🇪🇸", name: "España", code: "+34" },
                    ].map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>
                    ))}
                  </select>
                  <input className="form-input" placeholder="+502 4444-4444" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
              </div>
              {/* Redes sociales */}
<div style={{ marginTop: 8, marginBottom: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, marginBottom: 14, color: "var(--muted)" }}>
    REDES SOCIALES
  </div>

  {[
    {
      key: "instagram", label: "Instagram", placeholder: "@tuusuario",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
        </svg>
      ),
    },
    {
      key: "tiktok", label: "TikTok", placeholder: "@tuusuario",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.79a4.85 4.85 0 01-1.01-.1z"/>
        </svg>
      ),
    },
    {
      key: "facebook", label: "Facebook", placeholder: "nombre.de.pagina",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
    },
    {
      key: "telegram", label: "Telegram", placeholder: "@tuusuario",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
    },
    {
      key: "whatsapp", label: "WhatsApp", placeholder: "50212345678 (con código de país)",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
    },
  ].map(({ key, label, placeholder, icon }) => (
    <div className="form-group" key={key}>
      <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--orange)" }}>{icon}</span>
        {label}
      </label>
      <input
        className="form-input"
        placeholder={placeholder}
        value={editForm[key]}
        onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
      />
    </div>
  ))}
</div>
              <button className="upload-btn" onClick={handleEditProfile} disabled={editLoading}>
                {editLoading ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
              </button>

             {/* Suscripción */}
<div id="subscription-section" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 14 }}>SUSCRIPCIÓN</div>
  <div className="form-group">
    <label className="form-label">Precio mensual (Q) — 0 = sin suscripción</label>
    <input className="form-input" type="number" placeholder="0" defaultValue={profile.subscription_price || ""} id="sub-price-input" />
  </div>
  <div className="form-group">
    <label className="form-label">Beneficios (uno por línea)</label>
    <textarea className="form-input" rows={3} defaultValue={(profile.subscription_benefits || []).join("\n")} id="sub-benefits-input" style={{ resize: "vertical", lineHeight: 1.6 }} />
  </div>
  <button className="nav-btn primary" onClick={async () => {
    const price = document.getElementById("sub-price-input").value;
    const benefits = document.getElementById("sub-benefits-input").value.split("\n").map(b => b.trim()).filter(Boolean);
    const res = await fetch("/api/auth/subscription-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ subscription_price: price ? parseFloat(price) : null, subscription_benefits: benefits }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(prev => ({ ...prev, subscription_price: data.photographer.subscription_price, subscription_benefits: data.photographer.subscription_benefits }));
      showToast("✓ Configuración de suscripción guardada.");
    } else setMessage(data.error);
  }}>
    Guardar configuración
  </button>

  {/* Mis suscripciones activas e historial */}
  <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1 }}>MIS SUSCRIPCIONES</div>
      <button className="nav-btn" style={{ fontSize: 12 }} onClick={() => fetchAllSubscriptions()}>🔄 Cargar</button>
    </div>

    {subsLoading ? (
      <div className="empty"><div className="empty-icon">⏳</div><div>Cargando...</div></div>
    ) : allSubscriptions.length === 0 ? (
      <div style={{ fontSize: 13, color: "var(--muted)" }}>No tenés suscripciones registradas.</div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {allSubscriptions.filter(s => s.status === "active").length > 0 && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>✓ Activas</div>
        )}
        {allSubscriptions.filter(s => s.status === "active").map(sub => (
          <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, background: "rgba(61,220,132,0.06)", border: "1px solid rgba(61,220,132,0.25)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
              {sub.photographer?.avatar_url
                ? <img src={sub.photographer.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>👤</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{sub.photographer?.name}</div>
              <div style={{ fontSize: 12, color: "var(--orange)" }}>{sub.photographer?.handle}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Q{sub.price}/mes · Vence: {new Date(sub.expires_at).toLocaleDateString("es-GT")}
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                if (!confirm("¿Cancelar esta suscripción?")) return;
                const res = await fetch(`/api/auth/subscriptions/${sub.id}/cancel`, {
                  method: "PUT",
                  headers: { Authorization: `Bearer ${session?.access_token}` }
                });
                if (res.ok) { showToast("Suscripción cancelada."); fetchAllSubscriptions(); }
              }}
              style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.4)", color: "#ff4444", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Cancelar
            </motion.button>
          </div>
        ))}

        {allSubscriptions.filter(s => s.status !== "active").length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>Historial</div>
            {allSubscriptions.filter(s => s.status !== "active").map(sub => (
              <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", opacity: 0.7 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
                  {sub.photographer?.avatar_url
                    ? <img src={sub.photographer.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>👤</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{sub.photographer?.name}</div>
                  <div style={{ fontSize: 12, color: "var(--orange)" }}>{sub.photographer?.handle}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    Q{sub.price}/mes · {sub.status === "cancelled" ? "Cancelada" : "Vencida"} · {new Date(sub.expires_at).toLocaleDateString("es-GT")}
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (user && sub.photographer.id === selectedPhotographer?.id || 
                        photographers.find(p => p.id === sub.photographer.id)?.user_id === user?.id) {
                      setView(VIEWS.VENDOR_REQUEST);
                      setActiveTab("profile");
                    } else {
                      fetchPhotographerProfile(sub.photographer.id);
                      setView(VIEWS.PHOTOGRAPHER_PROFILE);
                    }
                  }}
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Ver perfil
                </motion.button>
              </div>
            ))}
          </>
        )}
      </div>
    )}
  </div>
</div>
</div>
)}

          {/* Sus fotos */}
          {!editMode && (
  <>
    {/* Tabs */}
    <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20, marginLeft: -20, marginRight: -20, justifyContent: "center" }}>
      {[
        { id: "publicaciones", label: "PUBLICACIONES" },
        { id: "medios", label: "MEDIOS" },
      ].map(tab => (
        <button key={tab.id} onClick={() => setProfileTab(tab.id)}
          style={{ background: "none", border: "none", color: profileTab === tab.id ? "var(--orange)" : "var(--muted)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, padding: "10px 20px", cursor: "pointer", borderBottom: `2px solid ${profileTab === tab.id ? "var(--orange)" : "transparent"}`, transition: "all 0.2s" }}>
          {tab.label}
        </button>
      ))}
    </div>

    {/* ── TAB: PUBLICACIONES ── */}
    {profileTab === "publicaciones" && (
      <div>
        {/* Formulario nueva publicación */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Compartí una actualización con tus seguidores..."
            value={postForm.body}
            onChange={e => setPostForm({ ...postForm, body: e.target.value })}
            style={{ resize: "none", lineHeight: 1.6, marginBottom: 10 }}
          />
          <input
            className="form-input"
            placeholder="URL de imagen (opcional)"
            value={postForm.image_url}
            onChange={e => setPostForm({ ...postForm, image_url: e.target.value })}
            style={{ marginBottom: 10 }}
          />
          <button className="nav-btn primary" style={{ width: "100%" }}
            disabled={postLoading || !postForm.body.trim()}
            onClick={async () => {
              setPostLoading(true);
              try {
                const res = await fetch("/api/auth/posts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
                  body: JSON.stringify(postForm),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                setPosts(prev => [data.post, ...prev]);
                setPostForm({ body: "", image_url: "" });
              } catch (err) {
                setMessage(err.message);
              } finally {
                setPostLoading(false);
              }
            }}>
            {postLoading ? "Publicando..." : "📢 PUBLICAR"}
          </button>
        </div>

        {/* Lista de publicaciones */}
        {postsLoading ? (
          <div className="empty"><div className="empty-icon">⏳</div><div>Cargando...</div></div>
        ) : posts.length === 0 ? (
          <div className="empty"><div className="empty-icon">📝</div><div>Todavía no publicaste nada.</div></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.map(post => (
              <div key={post.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                {post.image_url && (
                  <img src={post.image_url} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "cover" }} />
                )}
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
                      {profile.avatar_url
                        ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>👤</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{profile.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(post.created_at).toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm("¿Eliminar esta publicación?")) return;
                        const res = await fetch(`/api/auth/posts/${post.id}`, {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${session?.access_token}` },
                        });
                        if (res.ok) setPosts(prev => prev.filter(p => p.id !== post.id));
                      }}
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, padding: 4 }}
                    >
                      Eliminar
                    </button>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}>{post.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* ── TAB: MEDIOS ── */}
    {profileTab === "medios" && (
      <div>
        {/* Álbumes */}
        {albums.filter(a => photos.filter(p => p.photographer?.user_id === user?.id && p.album_id === a.id).length > 0).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 12 }}>🗂️ ÁLBUMES</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {albums.map(album => {
  const albumPhotos = photos.filter(p => p.photographer?.user_id === user?.id && p.album_id === album.id);
  if (albumPhotos.length === 0) return null;
  const cover = album.cover_url 
  ? album.cover_url.split("?")[0] + `?t=${album.id}`
  : albumPhotos[0]?.watermark_url;

  return (
    <div key={album.id} 
  onClick={() => { setSelectedAlbum(album); setActiveTab("gallery"); setView(VIEWS.MY_GALLERY); }}
  style={{ borderRadius: 10, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}>
      {/* Thumbnail */}
      <div style={{ height: 90, background: "var(--card)", overflow: "hidden", position: "relative" }}>
        {cover && <img src={cover} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}

        {/* Botón cambiar portada */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 6, opacity: 0, transition: "opacity 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0}>
          <button
            onClick={e => { e.stopPropagation(); document.getElementById(`cover-${album.id}`).click(); }}
            style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
            📷 Portada
          </button>
        </div>

        {/* Input oculto — seleccionar foto del álbum */}
        <input type="file" id={`cover-${album.id}`} accept="image/*" style={{ display: "none" }}
          onChange={async e => {
            const file = e.target.files[0];
            if (!file) return;
            setGlobalLoading({ active: true, message: "Actualizando portada..." });
            try {
              const formData = new FormData();
              formData.append("cover", file);
              const res = await fetch(`/api/auth/album-cover/${album.id}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session?.access_token}` },
                body: formData,
              });
              const data = await res.json();
              if (res.ok) {
                await fetchAlbums(profile.id);
                showToast("✓ Portada actualizada.")
              } else {
                setMessage(data.error);
              }
            } finally {
              setGlobalLoading({ active: false, message: "" });
            }
          }} />
      </div>

      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontWeight: 700, fontSize: 12 }}>{album.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{albumPhotos.length} foto{albumPhotos.length !== 1 ? "s" : ""}</div>
      </div>
    </div>
  );
})}
            </div>
          </div>
        )}

        {/* Fotos sueltas */}
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>
    📸 FOTOS · {photos.filter(p => p.photographer?.user_id === user?.id).length}
  </div>
  <div style={{ display: "flex", gap: 4 }}>
    {[{ mode: "grid", icon: "⊞" }, { mode: "feed", icon: "☰" }].map(({ mode, icon }) => (
      <button
        key={mode}
        onClick={() => setPhotoViewMode(mode)}
        style={{
          background: photoViewMode === mode ? "var(--orange)" : "var(--surface)",
          border: `1px solid ${photoViewMode === mode ? "var(--orange)" : "var(--border)"}`,
          color: photoViewMode === mode ? "#fff" : "var(--muted)",
          borderRadius: 8, padding: "6px 10px", cursor: "pointer",
          fontSize: 16, transition: "all 0.2s",
        }}
      >{icon}</button>
    ))}
  </div>
</div>

{photos.filter(p => p.photographer?.user_id === user?.id).length === 0 ? (
  <div className="empty">
    <div className="empty-icon">📷</div>
    <div>Todavía no subiste fotos.</div>
    <button className="nav-btn primary" style={{ marginTop: 16 }} onClick={() => { setActiveTab("upload"); setView(VIEWS.UPLOAD); }}>
      Subir primera foto
    </button>
  </div>
) : photoViewMode === "grid" ? (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginLeft: -20, marginRight: -20 }}>
    {photos.filter(p => p.photographer?.user_id === user?.id).map(photo => (
      <div
        key={photo.id}
        onClick={() => { setSelected(photo); setView(VIEWS.DETAIL); }}
        style={{ aspectRatio: "1", overflow: "hidden", position: "relative", background: "var(--card)", cursor: "pointer" }}
      >
        <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    ))}
  </div>
) : (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {photos.filter(p => p.photographer?.user_id === user?.id).map(photo => (
      <div
        key={photo.id}
        onClick={() => { setSelected(photo); setView(VIEWS.DETAIL); }}
        style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}
      >
        <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden" }}>
          <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>📍 {photo.location}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {photo.ride_date || ""}
              {photo.time_start ? ` · ${photo.time_start}${photo.time_end ? `–${photo.time_end}` : ""}` : ""}
            </div>
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "var(--text)" }}>
            Q{photo.price}
          </div>
        </div>
      </div>
    ))}
  </div>
)}
      </div>
            )}
          </>
          )}
        </div>
      </div>
    );
  }

  // ── SIN PERFIL: formulario de solicitud + buyer profile ────────
  if (!profile) {
    return (
      <div className="upload-view">
        <div className="section-title">👤 PERFIL</div>

        {/* Info básica del comprador */}
        <div style={{ padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--card)", border: "2px solid var(--border)", display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{user.email}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Comprador</div>
            </div>
          </div>
        </div>

        {/* CTA fotógrafo */}
        <div style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.1), rgba(255,107,0,0.04))", border: "1px solid var(--orange)", borderRadius: 14, padding: 20, marginBottom: 28 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, marginBottom: 8 }}>¿SOS FOTÓGRAFO?</div>
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Creá tu perfil verificado, subí tus fotos de rodada y empezá a vender. El proceso es rápido y gratuito.
          </div>
          <button className="upload-btn" onClick={() => setProfile({ _requestMode: true })}>
            QUIERO SER FOTÓGRAFO
          </button>
        </div>

        <button className="close-btn-secondary" onClick={handleLogout}>Cerrar sesión</button>
      </div>
    );
  }

  // ── PERFIL PENDIENTE / RECHAZADO ───────────────────────────────
  if (profile._requestMode) {
    return (
      <div className="upload-view">
        <div className="section-title">SOLICITAR PERFIL</div>
        <div className="section-sub">Completá el formulario para verificar tu cuenta.</div>

        <div className="form-group">
          <label className="form-label">Nombre completo</label>
          <input className="form-input" value={vendorForm.name} onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} placeholder="Juan Pérez" />
        </div>
        <div className="form-group">
          <label className="form-label">Handle público</label>
          <input className="form-input" value={vendorForm.handle} onChange={e => setVendorForm({ ...vendorForm, handle: e.target.value })} placeholder="@juanmotos" />
        </div>
        <div className="form-group">
          <label className="form-label">DPI / Identificación</label>
          <input className="form-input" value={vendorForm.verification_id} onChange={e => setVendorForm({ ...vendorForm, verification_id: e.target.value })} placeholder="12345678" />
        </div>
        <div className="form-group">
          <label className="form-label">Bio corta (opcional)</label>
          <input className="form-input" value={vendorForm.bio} onChange={e => setVendorForm({ ...vendorForm, bio: e.target.value })} placeholder="Fotógrafo de rodadas en Guatemala" />
        </div>
        <button className="upload-btn" onClick={handleRequestVendor}>ENVIAR SOLICITUD</button>
        <button className="close-btn-secondary" style={{ marginTop: 12 }} onClick={() => setProfile(null)}>← Volver</button>
      </div>
    );
  }

  // Pendiente de aprobación
  return (
    <div className="upload-view">
      <div className="section-title">👤 PERFIL</div>
      <div style={{ padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{profile.name || user.email}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{profile.handle || ""}</div>
      </div>
      <div className="empty">
        <div className="empty-icon">⏳</div>
        <div>Tu solicitud está <strong style={{ color: "var(--orange)" }}>{profile.verification_status}</strong>.<br />Esperá la aprobación del administrador.</div>
      </div>
      <button className="close-btn-secondary" style={{ marginTop: 12 }} onClick={handleLogout}>Cerrar sesión</button>
    </div>
  );
};

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --bg: #0c0c0c; --surface: #161616; --card: #1c1c1c; --border: #2a2a2a;
      --orange: #ff6b00; --orange-glow: rgba(255,107,0,0.18); --text: #f0ece4; --muted: #6a6a6a; --success: #3ddc84; }
    body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }
    .app { min-height: 100vh; display: flex; flex-direction: column; }
    .nav { position: sticky; top: 0; z-index: 100; background: rgba(12,12,12,0.94); backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: sp
      ace-between; padding: 0 20px; height: 58px; }
    .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 2px; color: var(--text); display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .nav-logo span { color: var(--orange); }
    .nav-actions { display: flex; gap: 10px; align-items: center; margin-left: auto; }
    .nav-btn { background: none; border: 1px solid var(--border); color: var(--muted); padding: 8px 14px; border-radius: 8px;
      font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer; transition: all 0.2s; }
    .nav-btn:hover { border-color: var(--orange); color: var(--text); }
    .nav-btn.primary { background: var(--orange); border-color: var(--orange); color: #fff; font-weight: 700; }
    .nav-btn.primary:hover { background: #e55e00; }
    .hero { padding: 44px 20px 28px; text-align: center; background: radial-gradient(circle at top, rgba(255,107,0,0.12), transparent 70%); border-bottom: 1px solid var(--border); }
    .hero-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(42px, 8vw, 76px); letter-spacing: 4px; line-height: 1; color: var(--text); }
    .hero-title span { color: var(--orange); }
    .hero-sub { color: var(--muted); font-size: 15px; margin-top: 10px; font-weight: 300; }
    .search-bar { display: flex; gap: 10px; margin: 20px; }
    .search-input { flex: 1; background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 12px 16px;
      border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; }
    .search-input:focus { border-color: var(--orange); }
    .search-input::placeholder { color: var(--muted); }
    .tag-row { display: flex; gap: 8px; padding: 0 20px 20px; overflow-x: auto; scrollbar-width: none; }
    .tag { white-space: nowrap; padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 13px; cursor: pointer; transition: all 0.2s; }
    .tag.active { background: var(--orange); border-color: var(--orange); color: #fff; font-weight: 700; }
    .tag:hover:not(.active) { border-color: var(--orange); color: var(--text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2px; padding: 0 2px 80px; }
    .card { position: relative; overflow: hidden; background: var(--card); aspect-ratio: 4/3; cursor: pointer; transition: transform 0.3s; }
    .card:hover { z-index: 2; transform: scale(1.02); }
    .card-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%);
      opacity: 0; transition: opacity 0.25s; display: flex; flex-direction: column; justify-content: flex-end; padding: 16px; }
    .card:hover .card-overlay { opacity: 1; }
    .card-photographer { font-size: 12px; color: var(--orange); font-weight: 700; letter-spacing: 0.5px; }
    .card-location { font-size: 11px; color: rgba(240,236,228,0.7); margin-top: 2px; }
    .card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .card-price { font-family: 'Bebas Neue', sans-serif; font-size: 22px; color: #fff; letter-spacing: 1px; }
    .card-buy { background: var(--orange); color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.2s; font-family: 'DM Sans', sans-serif; }
    .card-buy:hover { background: #e55e00; }
    .card-bought-badge { position: absolute; top: 10px; right: 10px; background: var(--success); color: #000; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 20px; z-index: 5; }
    .card-photo-badge { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.65); color: var(--orange); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; z-index: 5; border: 1px solid rgba(255,107,0,0.3); }
    .modal-backdrop { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.88); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.3s ease-out; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .modal-header { padding: 20px 20px 0; display: flex; justify-content: space-between; align-items: center; }
    .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px; color: var(--text); }
    .modal-close { background: var(--card); border: 1px solid var(--border); color: var(--muted); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .modal-close:hover { color: var(--text); border-color: var(--orange); }
    .modal-photo { width: 100%; aspect-ratio: 4/3; margin: 16px 0 0; overflow: hidden; }
    .modal-body { padding: 16px 20px 24px; }
    .modal-meta { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .modal-meta-photographer { color: var(--orange); font-weight: 700; font-size: 14px; }
    .modal-meta-location { color: var(--muted); font-size: 12px; margin-top: 2px; }
    .modal-price { font-family: 'Bebas Neue', sans-serif; font-size: 36px; color: var(--text); letter-spacing: 1px; }
    .modal-price-unit { font-size: 14px; color: var(--muted); }
    .pay-label { font-size: 12px; color: var(--muted); letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 700; text-transform: uppercase; }
    .pay-methods { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .pay-method { display: flex; align-items: center; gap: 10px; background: var(--card); border: 1.5px solid var(--orange); background: var(--orange-glow);
      border-radius: 10px; padding: 12px 14px; color: var(--text); font-size: 14px; }
    .pay-method-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--orange); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .pay-method-dot::after { content: ''; display: block; width: 8px; height: 8px; border-radius: 50%; background: var(--orange); }
    .pay-btn, .upload-btn { width: 100%; padding: 14px; background: var(--orange); border: none; border-radius: 10px; color: #fff;
      font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; }
    .pay-btn:hover, .upload-btn:hover:not(:disabled) { background: #e55e00; transform: translateY(-1px); }
    .pay-btn:disabled, .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .download-btn { width: 100%; padding: 14px; background: var(--success); border: none; border-radius: 10px; color: #000;
      font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; }
    .download-btn:hover { transform: translateY(-1px); }
    .processing { text-align: center; padding: 32px 0; }
    .processing-spinner { width: 48px; height: 48px; border: 3px solid var(--border); border-top-color: var(--orange); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .processing-text { color: var(--muted); font-size: 14px; }
    .close-btn-secondary { width: 100%; padding: 12px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; color: var(--muted); font-family: 'DM Sans', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s; }
    .close-btn-secondary:hover { color: var(--text); border-color: var(--orange); }
    .upload-view { padding: 24px 20px 80px; max-width: 540px; margin: 0 auto; }
    .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 2px; color: var(--text); margin-bottom: 6px; }
    .section-sub { color: var(--muted); font-size: 14px; margin-bottom: 28px; }
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .form-input { width: 100%; background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 12px 14px; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; }
    .form-input:focus { border-color: var(--orange); }
    .form-input::placeholder { color: var(--muted); }
    .dropzone { border: 2px dashed var(--border); border-radius: 12px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--surface); }
    .dropzone:hover, .dropzone.active { border-color: var(--orange); background: var(--orange-glow); }
    .dropzone-icon { font-size: 36px; margin-bottom: 10px; }
    .dropzone-text { color: var(--muted); font-size: 14px; }
    .upload-success-banner { background: rgba(61,220,132,0.12); border: 1px solid var(--success); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; color: var(--success); font-weight: 600; font-size: 14px; }
    .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: rgba(12,12,12,0.96); backdrop-filter: blur(16px); border-top: 1px solid var(--border); display: flex; justify-content: center; overflow-x: auto; scrollbar-width: none; padding: 8px 0 12px; }
    .bnav-item { display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; padding: 4px 16px; border: none; background: none; color: var(--muted); font-family: 'DM Sans', sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; transition: color 0.2s; flex-shrink: 0; position: relative; }
    .bnav-item.active { color: var(--orange); }
    .bnav-icon { font-size: 20px; line-height: 1; transition: transform 0.2s; }
    .bnav-item.active .bnav-icon { transform: translateY(-2px); }
    .bnav-pill { position: absolute; bottom: 0; left: 0;right: 0;margin: 0 auto; width: 20px; height: 3px; background: var(--orange); border-radius: 3px 3px 0 0;}
    .bnav-icon { font-size: 20px; line-height: 1; }
    .empty { text-align: center; padding: 60px 20px; color: var(--muted); }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .success-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; background: radial-gradient(circle at center, rgba(61,220,132,0.08), transparent 70%); }
    .success-page-icon { font-size: 72px; margin-bottom: 16px; }
    .success-page-title { font-family: 'Bebas Neue', sans-serif; font-size: 52px; letter-spacing: 4px; color: var(--success); }
    .success-page-sub { color: var(--muted); font-size: 16px; margin: 10px 0 32px; line-height: 1.6; }
    .success-page-card { background: var(--surface); border: 1px solid rgba(61,220,132,0.25); border-radius: 16px; padding: 20px; width: 100%; max-width: 320px; margin-bottom: 24px; }
    .success-page-photo { width: 100%; aspect-ratio: 4/3; border-radius: 10px; overflow: hidden; margin-bottom: 12px; background: var(--card); }
    .success-page-info { text-align: left; font-size: 13px; color: var(--muted); line-height: 1.8; }
    .success-page-info strong { color: var(--text); }
    .card-buy { transition: transform 0.15s, background 0.2s; }
    .card-buy:active { transform: scale(0.93); }
    .nav-btn { transition: all 0.2s; }
    .nav-btn:active { transform: scale(0.95); }
    .close-btn-secondary:active { transform: scale(0.97); }
  `;

  const renderAuth = () => (
    <div className="upload-view">
      <div className="section-title">{authMode === "login" ? "INICIAR SESIÓN" : "REGISTRARSE"}</div>
      <div className="section-sub">Creá una cuenta o iniciá sesión para comprar fotos.</div>
      {authMode === "register" && (
        <div className="form-group">
          <label className="form-label">Nombre completo</label>
          <input className="form-input" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Juan Pérez" />
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Email</label>
        <input type="email" className="form-input" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="email@example.com" />
      </div>
      <div className="form-group">
        <label className="form-label">Contraseña</label>
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            className="form-input"
            value={authForm.password}
            onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
            placeholder="********"
            style={{ paddingRight: 40 }}
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18 }}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      <button className="upload-btn" onClick={authMode === "login" ? handleLogin : handleSignUp}>
        {authMode === "login" ? "INICIAR SESIÓN" : "CREAR CUENTA"}
      </button>
      <button className="close-btn-secondary" style={{ marginTop: 12 }} onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
        {authMode === "login" ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Iniciá sesión"}
      </button>
      <button className="close-btn-secondary" style={{ marginTop: 12 }} onClick={() => setView(VIEWS.PHOTOGRAPHERS)}>Volver</button>
    </div>
  );

  const renderSuccessPage = () => (
    <div className="success-page">
      <div className="success-page-icon">🏍️</div>
      <div className="success-page-title">¡LISTO!</div>
      <div className="success-page-sub">Tu foto está disponible para descargar.</div>
      {selected && (
        <div className="success-page-card">
          <div className="success-page-photo">
            <img src={selected.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div className="success-page-info">
            <strong>📸 {selected.photographer?.name}</strong><br />
            📍 {selected.location}<br />
            💰 Pagado: <strong style={{ color: "var(--success)" }}>Q{selected.price}</strong>
          </div>
        </div>
      )}
      <button className="nav-btn primary" style={{ width: "100%", maxWidth: 320, padding: 14, fontSize: 16 }} onClick={() => setView(VIEWS.PHOTOGRAPHERS)}>
        Explorar más fotos →
      </button>
    </div>
  );
  //ULTIMO RETURN
  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Modal suscripción */}
<AnimatePresence>
  {showSubscribeModal && selectedPhotographer && (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setShowSubscribeModal(false)}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 40 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">SUSCRIBIRSE</div>
          <button className="modal-close" onClick={() => setShowSubscribeModal(false)}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
              {selectedPhotographer?.avatar_url
                ? <img src={selectedPhotographer.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>👤</div>}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{selectedPhotographer?.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{selectedPhotographer?.handle}</div>
            </div>
          </div>
          {selectedPhotographer?.subscription_benefits?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                Suscribite y obtené estas ventajas:
              </div>
              {selectedPhotographer?.subscription_benefits?.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, marginBottom: 10 }}
                >
                  <span style={{ color: "var(--success)", fontWeight: 700, marginTop: 1 }}>✓</span>
                  <span>{b}</span>
                </motion.div>
              ))}
            </div>
          )}
          <motion.button
            className="pay-btn"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              if (!user) { setShowSubscribeModal(false); setView(VIEWS.AUTH); return; }
              const res = await fetch(`/api/auth/subscribe/${selectedPhotographer?.id}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session?.access_token}` },
              });
              const data = await res.json();
              setShowSubscribeModal(false);
              if (res.ok) showToast("Suscripción activa.");
              else setMessage(data.error);
            }}
          >
            SUSCRIBIRME · Q{selectedPhotographer?.subscription_price}/MES
          </motion.button>
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
            <div>· Tu suscripción se renovará mensualmente hasta que la canceles.</div>
            <div>· Al cancelar, seguirás teniendo acceso hasta que caduque.</div>
          </div>
          <button className="close-btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowSubscribeModal(false)}>
            Cerrar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

       {/* Modal álbum */}
<AnimatePresence>
  {showAlbumModal && (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setShowAlbumModal(false)}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 40 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">NUEVO ÁLBUM</div>
          <button className="modal-close" onClick={() => setShowAlbumModal(false)}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre del álbum / Evento</label>
            <input className="form-input"
              placeholder="Ej: Copa Yamaha 2025"
              value={albumForm.name}
              onChange={e => setAlbumForm({ ...albumForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha del evento</label>
            <input className="form-input" type="date"
              value={albumForm.event_date}
              onChange={e => setAlbumForm({ ...albumForm, event_date: e.target.value })} />
          </div>
          <motion.button
            className="pay-btn"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              if (!albumForm.name) return;
              const res = await fetch("/api/auth/albums", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
                body: JSON.stringify(albumForm),
              });
              const data = await res.json();
              if (res.ok) {
                setAlbums(prev => [data.album, ...prev]);
                setUploadForm(prev => ({ ...prev, album_id: data.album.id }));
                setAlbumForm({ name: "", event_date: "" });
                setShowAlbumModal(false);
              }
            }}
          >
            CREAR ÁLBUM
          </motion.button>
          <button className="close-btn-secondary" style={{ marginTop: 10 }} onClick={() => setShowAlbumModal(false)}>
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

<nav className="nav">
  <div className="nav-logo" onClick={() => { setView(VIEWS.PHOTOGRAPHERS); setActiveTab("feed"); }} >
    MOTO<span>SHOT</span>
  </div>
  <div className="nav-actions">
    {user ? (
      <>
        {profile?.verification_status === "approved" ? (
          <span
          onClick={() => setView(VIEWS.VENDOR_REQUEST)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            cursor: "pointer", color: "var(--text)", fontSize: 13, fontWeight: 700,
          }}
        >
          {profile?.name || "Fotógrafo"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </span>
        ) : (
          <button className="nav-btn" onClick={() => setView(VIEWS.VENDOR_REQUEST)}>
            Request vendor
          </button>
        )}
        <button className="nav-btn primary" onClick={handleLogout}>Cerrar Sesión</button>
      </>
    ) : (
      <button className="nav-btn primary" onClick={() => setView(VIEWS.AUTH)}>Ingresar</button>
    )}
  </div>
</nav>

<div style={{ flex: 1 }}>
  <AnimatePresence mode="wait">
    <motion.div
      key={view}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {view === VIEWS.GALLERY && renderGallery()}
      {view === VIEWS.DETAIL && renderDetail()}
      {view === VIEWS.UPLOAD && renderUpload()}
      {view === VIEWS.AUTH && renderAuth()}
      {view === VIEWS.VENDOR_REQUEST && renderVendorRequest()}
      {view === VIEWS.SUCCESS && renderSuccessPage()}
      {view === VIEWS.MY_PURCHASES && renderMyPurchases()}
      {view === VIEWS.NOTIFICATIONS && renderNotifications()}
      {view === VIEWS.PHOTOGRAPHERS && renderPhotographers()}
      {view === VIEWS.PHOTOGRAPHER_PROFILE && renderPhotographerProfile()}
      {view === VIEWS.ADMIN && renderAdmin()}
      {view === VIEWS.DASHBOARD && renderDashboard()}
      {view === VIEWS.MY_GALLERY && renderMyGallery()}
    </motion.div>
  </AnimatePresence>
</div>

<AnimatePresence>
  {payStep > 0 && (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => payStep === 1 && setPayStep(0)}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 40 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">PAGAR CON PAYPAL</div>
          <button className="modal-close" onClick={() => setPayStep(0)}>×</button>
        </div>
        {selected && (
          <div className="modal-photo">
            <img src={selected.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div className="modal-body">
          {selected && (
            <div className="modal-meta">
              <div>
                <div className="modal-meta-photographer">{selected.photographer?.name}</div>
                <div className="modal-meta-location">📍 {selected.location}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="modal-price">Q{selected.price}</div>
                <div className="modal-price-unit">Alta resolución</div>
              </div>
            </div>
          )}
          {payStep === 1 && (
            <>
              <div className="pay-label">Método de pago</div>
              <div className="pay-methods">
                <div className="pay-method">
                  <div className="pay-method-dot"></div>
                  <span>💳 PayPal</span>
                </div>
              </div>
              <motion.button
                className="pay-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handlePayment}
              >
                PAGAR Q{selected?.price} CON PAYPAL
              </motion.button>
            </>
          )}
          {payStep === 2 && (
            <div className="processing">
              <div className="processing-spinner"></div>
              <div className="processing-text">Redirigiendo a PayPal...</div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

{view !== VIEWS.SUCCESS &&
  view !== VIEWS.AUTH && (
    <nav className="bottom-nav">
      {[
        { id: "feed", icon: "🏍️", label: "Inicio", v: VIEWS.PHOTOGRAPHERS },

        // Solo fotógrafos aprobados ven "Subir"
        ...(profile?.verification_status === "approved"
          ? [{ id: "upload", icon: "📸", label: "Subir", v: VIEWS.UPLOAD }]
          : []),

        // Fotógrafo → Dashboard | Comprador → Compras
        ...(profile?.verification_status === "approved"
          ? [{ id: "dash", icon: "📊", label: "Dashboard", v: VIEWS.DASHBOARD }]
          : [{ id: "purchases", icon: "🧾", label: "Compras", v: VIEWS.MY_PURCHASES }]),

        // Galería para todos
        { id: "gallery", icon: "🖼️", label: "Galería", v: VIEWS.MY_GALLERY },

        // Perfil para todos
        { id: "profile", icon: "👤", label: "Perfil", v: VIEWS.VENDOR_REQUEST },

        // Admin
        ...(isAdmin ? [{ id: "admin", icon: "⚙️", label: "Admin", v: VIEWS.ADMIN }] : []),]
        .map((item) => (
        <button
          key={item.id}
          className={`bnav-item${activeTab === item.id ? " active" : ""}`}
          onClick={() => {
            setActiveTab(item.id);
            setView(item.v);
          }}
        >
          <motion.span
            className="bnav-icon"
            whileTap={{ scale: 0.8 }}
            animate={{ scale: activeTab === item.id ? 1.15 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {item.icon}
          </motion.span>
          {item.label}
          {activeTab === item.id && (
            <motion.div
              className="bnav-pill"
              layoutId="bnav-pill"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </nav>
  )}
  {/* Toast global */}
<AnimatePresence>
{message && (
  <motion.div
    initial={{ opacity: 0, y: -60, scale: 0.95, x: "-50%" }}
    animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
    exit={{ opacity: 0, y: -60, scale: 0.95, x: "-50%" }}
    transition={{ type: "spring", stiffness: 400, damping: 30 }}
    style={(() => {
      const isSuccess = message.startsWith("✓") || message.includes("actualiz") || message.includes("activa") || message.includes("guardad") || message.includes("exitosa");
      const isError = message.toLowerCase().includes("invalid") || message.toLowerCase().includes("error") || message.toLowerCase().includes("incorrect") || message.toLowerCase().includes("fallid");
      const toastColor = isSuccess ? "var(--success)" : isError ? "#ff4444" : "var(--orange)";
      const toastBg = isSuccess ? "rgba(61,220,132,0.12)" : isError ? "rgba(255,68,68,0.12)" : "rgba(255,107,0,0.12)";
      return {
        position: "fixed", top: 70, left: "50%",
        zIndex: 999, maxWidth: 340, width: "90%",
        background: toastBg,
        border: `1px solid ${toastColor}`,
        borderRadius: 12, padding: "12px 20px",
        color: toastColor,
        fontSize: 14, fontWeight: 600, textAlign: "center",
        backdropFilter: "blur(12px)",
      };
    })()}
  >
    {message}
  </motion.div>
)}
</AnimatePresence>
  {globalLoading.active && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
          }}>
            <div style={{ width: 48, height: 48, border: "3px solid var(--border)", borderTop: "3px solid var(--orange)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>
              {globalLoading.message || "Cargando..."}
            </div>
          </div>
        )}
      </div>
    </>
  );
}