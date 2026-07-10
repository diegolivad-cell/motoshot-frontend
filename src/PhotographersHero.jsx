"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { MotoShotBrandMark } from "./icons";
import { easings } from "./motionSystem";

export function PhotographersHero({
  videoSrc,
  videoRef,
  videoReady,
  onVideoReady,
  isLoggedIn,
  welcomeName,
}) {
  const sectionRef = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["0%", "28%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0.35]);

  const src = videoSrc;

  return (
    <div
      ref={sectionRef}
      style={{
        position: "relative",
        width: "100%",
        height: 320,
        overflow: "hidden",
        background: "#0a0a0a",
      }}
    >
      <motion.div style={{ y, opacity, position: "absolute", inset: 0, height: "130%", top: "-15%" }}>
        <video
          ref={videoRef}
          className="hero-video-bg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          controls={false}
          onLoadedData={onVideoReady}
          onCanPlay={onVideoReady}
          onPlaying={onVideoReady}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            willChange: "transform",
            zIndex: 0,
            opacity: videoReady ? 1 : 0,
            transition: "opacity 0.45s ease",
            pointerEvents: "none",
          }}
          src={src}
        />
      </motion.div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 3,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 20px",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: easings.out }}
        >
          <MotoShotBrandMark variant="hero-video" className="hero-title" />
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: easings.out }}
          style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, marginTop: 10, fontWeight: 300 }}
        >
          Encontrá al fotógrafo de tu rodada · Comprá tus fotos y videos acá
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28, ease: easings.out }}
        >
          {isLoggedIn ? (
            <div style={{ marginTop: 12, color: "#fff", fontSize: 14 }}>
              Bienvenido, {welcomeName}
            </div>
          ) : (
            <div
              style={{
                marginTop: 16,
                color: "var(--muted)",
                fontSize: 14,
                lineHeight: 1.5,
                maxWidth: 420,
                marginInline: "auto",
              }}
            >
              Explorá fotógrafos y comprá fotos o videos sin registrarte. Te pedimos solo tu correo
              para enviarte la confirmación.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
