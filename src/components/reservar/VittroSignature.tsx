import { VittroMark } from "@/components/VittroMark";

export function VittroSignature() {
  return (
    <a className="portal-signature" href="https://www.vittro.com.ar" target="_blank" rel="noopener noreferrer" aria-label="Reservas con Vittro, abre en otra pestaña">
      <span>Reservas con</span><VittroMark variant="wordmark" />
    </a>
  );
}
