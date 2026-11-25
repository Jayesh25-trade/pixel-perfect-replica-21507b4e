import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PartyType } from "@/lib/calculations";

interface AddPartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: PartyType | undefined;
  onPartyCreated: (party: {
    name: string;
    type: PartyType;
    phone?: string | undefined;
    credit_days?: number | undefined;
  }) => Promise<void>;
}

export function AddPartyDialog({
  open,
  onOpenChange,
  defaultType = "supplier",
  onPartyCreated,
}: AddPartyDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PartyType>(defaultType);
  const [phone, setPhone] = useState("");
  const [creditDays, setCreditDays] = useState("30");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      await onPartyCreated({
        name: name.trim(),
        type,
        phone: phone.trim() || undefined,
        credit_days: type === "buyer" ? parseInt(creditDays) || 30 : undefined,
      });
      setName("");
      setPhone("");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Party</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="party-name">Party Name</Label>
            <Input
              id="party-name"
              placeholder="e.g. Mahalakshmi Coal, Gujarat Roadways"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="min-h-12 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="party-type">Party Type</Label>
            <Select value={type} onValueChange={(val) => setType(val as PartyType)}>
              <SelectTrigger id="party-type" className="min-h-12 text-base">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supplier">Supplier (Coal/Briquette Purchase)</SelectItem>
                <SelectItem value="agency">Transport Agency (Freight)</SelectItem>
                <SelectItem value="buyer">Buyer (Customer)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="party-phone">Phone Number (Optional)</Label>
            <Input
              id="party-phone"
              type="tel"
              inputMode="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-12 text-base"
            />
          </div>

          {type === "buyer" && (
            <div className="space-y-1.5">
              <Label htmlFor="party-credit">Default Credit Days</Label>
              <Input
                id="party-credit"
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                value={creditDays}
                onChange={(e) => setCreditDays(e.target.value)}
                className="min-h-12 text-base"
              />
            </div>
          )}

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-12 flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="min-h-12 flex-1 font-semibold"
            >
              {loading ? "Adding..." : "Save Party"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
