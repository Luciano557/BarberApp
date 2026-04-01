import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { es } from "date-fns/locale";

interface Props {
  value: string;
  onSelect: (fecha: string) => void;
}

export const FechaStep = ({ value, onSelect }: Props) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selected = value ? new Date(value + "T12:00:00") : today;

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    onSelect(`${yyyy}-${mm}-${dd}`);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Elegí la fecha</h2>
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          disabled={(date) => date < today}
          locale={es}
          className="rounded-md border"
        />
      </div>
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={() => handleSelect(today)}>
          Hoy
        </Button>
      </div>
    </div>
  );
};
