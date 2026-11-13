import { useEffect, useRef, useState } from "react";

export function CameraCapture({
  onChange,
}: {
  onChange: (file: File | null) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    setReady(false);
    setError("");
    if (photo) return;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera unavailable. Open this page over HTTPS or localhost on a device with a camera.",
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error && err.message.startsWith("Camera unavailable")
              ? err.message
              : "Could not open the camera. Allow camera access and try again.",
          );
      }
    }
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [attempt, photo]);
  function capture() {
    const source = video.current;
    if (!source?.videoWidth || !source.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture image. Please try again.");
      return;
    }
    context.drawImage(source, 0, 0);
    const image = canvas.toDataURL("image/jpeg", 0.9);
    const bytes = Uint8Array.from(atob(image.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    onChange(new File([bytes], "locker-photo.jpg", { type: "image/jpeg" }));
    setPhoto(image);
  }
  return (
    <div className="camera-capture">
      <p>Photo of item inside locker</p>
      {photo ? (
        <img
          src={photo}
          alt="Captured item inside locker"
          style={{ width: "100%", maxWidth: 360, borderRadius: 8 }}
        />
      ) : (
        <video
          ref={video}
          aria-label="Live camera preview"
          autoPlay
          muted
          playsInline
          onCanPlay={() => setReady(true)}
          style={{
            display: "block",
            width: "100%",
            maxWidth: 360,
            aspectRatio: "4 / 3",
            objectFit: "cover",
            background: "#17212b",
            borderRadius: 8,
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
      <div className="camera-actions">
        {photo ? (
          <button
            className="camera-button"
            type="button"
            onClick={() => {
              onChange(null);
              setPhoto("");
            }}
          >
            Retake image
          </button>
        ) : (
          <button
            className="camera-button camera-button-primary"
            type="button"
            disabled={!ready}
            onClick={capture}
          >
            Capture image
          </button>
        )}
        {error && (
          <button
            className="camera-button"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry camera
          </button>
        )}
      </div>
    </div>
  );
}
