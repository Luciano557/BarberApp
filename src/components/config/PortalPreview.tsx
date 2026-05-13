import { BookingLanding, PortalDataView } from '@/components/reservar/BookingLanding';

interface Props {
  orgName: string;
  fallbackLogo: string | null;
  portal: PortalDataView;
}

export function PortalPreview({ orgName, fallbackLogo, portal }: Props) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[340px] rounded-[2rem] border border-border bg-background shadow-sm overflow-hidden">
        <div className="h-6 bg-muted/40 flex items-center justify-center">
          <div className="h-1 w-16 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          <div className="p-6">
            <BookingLanding
              orgName={orgName}
              fallbackLogo={fallbackLogo}
              portal={portal}
              onStart={() => {}}
              onManage={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
