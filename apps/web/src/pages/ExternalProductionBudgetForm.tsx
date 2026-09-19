import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AlertMessage from "../components/AlertMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import { fmtMoneyFull } from "../lib/format";
import { Icon } from "../lib/icons";
import { api } from "../services/api";

const card: CSSProperties = {
  background: "var(--surface,#fff)",
  border: "1px solid var(--border,#e5e8ec)",
  borderRadius: 16,
  boxShadow: "var(--shadow)",
  padding: "22px 24px",
};
const input: CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 13px",
  borderRadius: 10,
  border: "1px solid var(--border-strong,#d5d9e0)",
  background: "var(--surface,#fff)",
  color: "var(--fg,#0f172a)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
const label: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--fg-2,#334155)",
  marginBottom: 8,
};
const button: CSSProperties = {
  height: 40,
  padding: "0 15px",
  border: "1px solid var(--border-strong,#d5d9e0)",
  background: "var(--surface,#fff)",
  color: "var(--fg-2,#334155)",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 13.5,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};
const nowrapButton: CSSProperties = {
  ...button,
  justifyContent: "center",
  whiteSpace: "nowrap",
  flex: "none",
};
const readonlyInput: CSSProperties = {
  ...input,
  background: "var(--surface-2,#f7f8fa)",
  color: "var(--fg-2,#334155)",
};
const moneyText: CSSProperties = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontVariantNumeric: "tabular-nums",
};
const monoTotal: CSSProperties = {
  ...moneyText,
  fontSize: 13,
  fontWeight: 700,
  color: "var(--fg-2,#334155)",
  textAlign: "right",
  whiteSpace: "nowrap",
};
const detailTooltipBox: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: "calc(100% + 8px)",
  zIndex: 45,
  padding: "10px 12px",
  borderRadius: 10,
  background: "var(--fg,#0f172a)",
  color: "var(--surface,#fff)",
  boxShadow: "var(--shadow-lg)",
  fontSize: 12.5,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  pointerEvents: "none",
};
const detailInfoButton: CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  width: 22,
  height: 22,
  borderRadius: 999,
  border: "1px solid var(--border-strong,#d5d9e0)",
  color: "var(--primary,#0f172a)",
  background: "var(--surface,#fff)",
  display: "grid",
  placeItems: "center",
  cursor: "help",
  padding: 0,
};
const detailLinkedButton: CSSProperties = {
  ...detailInfoButton,
  color: "var(--primary,#0f172a)",
};
const infoIconPath = "M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";
const linkedIconPath = "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71";

interface Option {
  id: number;
  label: string;
}
interface CostOrderDetail {
  idDetalle: number;
  detalle: string | null;
  total: number;
  totalCobrado: number;
  disponible: number;
  assigned?: string;
}

function SearchSelect({
  value,
  label: labelText,
  placeholder,
  disabled,
  fetcher,
  onSelect,
}: {
  value: Option | null;
  label: string;
  placeholder: string;
  disabled?: boolean;
  fetcher: (search: string) => Promise<any>;
  onSelect: (opt: Option | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open || disabled) return;
    const timer = setTimeout(() => {
      setLoading(true);
      fetcher(q.trim())
        .then((res) => setOptions(res?.success ? res.data || [] : []))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, open, disabled, fetcher]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setHighlightedIndex(options.length ? 0 : -1);
    optionRefs.current = [];
  }, [options]);

  useEffect(() => {
    if (highlightedIndex < 0) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const selectOption = (opt: Option) => {
    onSelect(opt);
    setOpen(false);
    setQ("");
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        options.length ? Math.min(current + 1, options.length - 1) : -1,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        options.length ? Math.max(current - 1, 0) : -1,
      );
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && options[highlightedIndex]) {
        event.preventDefault();
        selectOption(options[highlightedIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <label style={label}>{labelText}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        style={{
          ...input,
          textAlign: "left",
          cursor: disabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: value ? "var(--fg,#0f172a)" : "var(--muted,#94a3b8)",
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value ? value.label : placeholder}
        </span>
        <Icon d="M6 9l6 6 6-6" size={16} sw={2} />
      </button>
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 30,
            marginTop: 4,
            background: "var(--surface,#fff)",
            border: "1px solid var(--border,#e5e8ec)",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 8,
              borderBottom: "1px solid var(--border,#e5e8ec)",
            }}
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Buscar…"
              style={{ ...input, height: 38 }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto", padding: 6 }}>
            {loading ? (
              <div
                style={{
                  padding: 12,
                  fontSize: 13,
                  color: "var(--muted,#64748b)",
                }}
              >
                Buscando…
              </div>
            ) : options.length ? (
              options.map((opt, index) => (
                <button
                  key={opt.id}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  onClick={() => selectOption(opt)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    background:
                      highlightedIndex === index
                        ? "var(--surface-2,#f7f8fa)"
                        : "transparent",
                    borderRadius: 7,
                    fontSize: 13,
                    color: "var(--fg-2,#334155)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {opt.label}
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: 12,
                  fontSize: 13,
                  color: "var(--muted,#64748b)",
                }}
              >
                Escribe para buscar.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const emptyHeader = {
  idCliente: "",
  idProveedor: "",
  idCampana: "",
  idProducto: "",
  idServicio: "",
  contrato: "0",
  ordenCliente: "",
  formaPago: "",
  cotizacion: "",
  observacion: "",
  ordenObservacion: "",
  descuento: "0",
  iva: "",
  spa: "",
  ivaSpa: "",
};
const emptyDetail = {
  id: null as number | null,
  unidad: "1",
  idServicio: "",
  detalle: "",
  valor: "",
  iva: "",
  incentivo: "0",
  costoIncentivo: "",
};

export default function ExternalProductionBudgetForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [header, setHeader] = useState(emptyHeader);
  const [details, setDetails] = useState<any[]>([]);
  const [detail, setDetail] = useState(emptyDetail);
  const [editable, setEditable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{
    action: "delete-detail";
    id?: number;
  } | null>(null);
  const [cliente, setCliente] = useState<Option | null>(null);
  const [proveedor, setProveedor] = useState<Option | null>(null);
  const [campaigns, setCampaigns] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [services, setServices] = useState<Option[]>([]);
  const [incentives, setIncentives] = useState<any[]>([]);
  const [ocIncentives, setOcIncentives] = useState<any[]>([]);
  const [ocIncentive, setOcIncentive] = useState("0");
  const [ocIncentiveCost, setOcIncentiveCost] = useState("");
  const [editableCostIds, setEditableCostIds] = useState<number[]>([]);
  const [ocId, setOcId] = useState("");
  const [ocDetails, setOcDetails] = useState<CostOrderDetail[]>([]);
  const [ocLoading, setOcLoading] = useState(false);
  const [ocSaving, setOcSaving] = useState<number | null>(null);
  const [detailTooltip, setDetailTooltip] = useState<{
    key: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (!state?.message) return;
    setMessage({ type: "success", text: state.message });
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    api
      .getExternalProductionBudgetOptions("services")
      .then((res) => setServices(res?.success ? res.data || [] : []));
  }, []);

  useEffect(() => {
    api
      .getExternalProductionBudgetDefaults(header.idCliente, header.idServicio)
      .then((res) => {
        if (!res?.success) return;
        setEditableCostIds(res.data.editableIncentiveCostServiceIds || []);
        setHeader((h) => ({
          ...h,
          iva: h.iva || String(res.data.iva),
          spa: String(res.data.spa),
          ivaSpa: h.ivaSpa || String(res.data.ivaSpa),
        }));
        setDetail((d) => ({ ...d, iva: d.iva || String(res.data.iva) }));
      });
  }, [header.idCliente, header.idServicio]);

  useEffect(() => {
    if (!header.idCliente) {
      setCampaigns([]);
      setProducts([]);
      return;
    }
    api
      .getExternalProductionBudgetOptions("campaigns", {
        clientId: header.idCliente,
      })
      .then((res) => setCampaigns(res?.success ? res.data || [] : []));
    api
      .getExternalProductionBudgetOptions("products", {
        clientId: header.idCliente,
      })
      .then((res) => setProducts(res?.success ? res.data || [] : []));
  }, [header.idCliente]);

  useEffect(() => {
    if (!header.idCliente || !header.idProveedor || !detail.idServicio) {
      setIncentives([]);
      return;
    }
    api
      .getExternalProductionBudgetIncentives({
        idCliente: header.idCliente,
        idProveedor: header.idProveedor,
        idServicio: detail.idServicio,
      })
      .then((res) => setIncentives(res?.success ? res.data || [] : []))
      .catch(() => setIncentives([]));
  }, [header.idCliente, header.idProveedor, detail.idServicio]);

  useEffect(() => {
    setOcIncentive("0");
    setOcIncentiveCost("");
    if (!header.idCliente || !header.idProveedor || !header.idServicio) {
      setOcIncentives([]);
      return;
    }
    api
      .getExternalProductionBudgetIncentives({
        idCliente: header.idCliente,
        idProveedor: header.idProveedor,
        idServicio: header.idServicio,
      })
      .then((res) => setOcIncentives(res?.success ? res.data || [] : []))
      .catch(() => setOcIncentives([]));
  }, [header.idCliente, header.idProveedor, header.idServicio]);

  const loadBudget = (budgetId: string | number) => {
    setLoading(true);
    api
      .getExternalProductionBudget(budgetId)
      .then((res) => {
        if (!res?.success) {
          setMessage({
            type: "error",
            text: res?.message || "No se pudo cargar.",
          });
          return;
        }
        const b = res.data;
        setEditable(!!b.editable);
        setHeader({
          idCliente: String(b.idCliente || ""),
          idProveedor: String(b.idProveedor || ""),
          idCampana: String(b.idCampana || ""),
          idProducto: String(b.idProducto || ""),
          idServicio: String(b.idServicio || ""),
          contrato: String(b.contrato ?? 0),
          ordenCliente: b.ordenCliente || "",
          formaPago: b.formaPago || "",
          cotizacion: b.cotizacion || "",
          observacion: b.observacion || "",
          ordenObservacion: b.ordenObservacion || "",
          descuento: String(b.descuento ?? 0),
          iva: String(b.iva ?? ""),
          spa: String(b.spa ?? ""),
          ivaSpa: String(b.ivaSpa ?? ""),
        });
        setCliente(
          b.idCliente
            ? { id: b.idCliente, label: b.cliente || `Cliente ${b.idCliente}` }
            : null,
        );
        setProveedor(
          b.idProveedor
            ? {
                id: b.idProveedor,
                label: b.proveedor || `Proveedor ${b.idProveedor}`,
              }
            : null,
        );
        setDetails(b.details || []);
        setDetail(emptyDetail);
      })
      .catch(() => setMessage({ type: "error", text: "No se pudo cargar." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isEdit || !id) return;
    loadBudget(id);
  }, [id, isEdit]);

  const subtotal = useMemo(
    () => details.reduce((sum, row) => sum + Number(row.valor || 0), 0),
    [details],
  );
  const descuento = (subtotal * (Number(header.descuento) || 0)) / 100;
  const base = subtotal - descuento;
  const iva = (base * (Number(header.iva) || 0)) / 100;
  const spa = (base * (Number(header.spa) || 0)) / 100;
  const ivaSpa = (spa * (Number(header.ivaSpa) || 0)) / 100;
  const total = base + iva + spa + ivaSpa;

  const setH = (key: string, value: string) =>
    setHeader((current) => ({ ...current, [key]: value }));
  const setD = (key: string, value: string) =>
    setDetail((current) => ({ ...current, [key]: value }));
  const onClienteChange = (opt: Option | null) => {
    setCliente(opt);
    setHeader((h) => ({
      ...h,
      idCliente: opt ? String(opt.id) : "",
      idCampana: "",
      idProducto: "",
    }));
    setOcDetails([]);
  };
  const onProveedorChange = (opt: Option | null) => {
    setProveedor(opt);
    setHeader((h) => ({ ...h, idProveedor: opt ? String(opt.id) : "" }));
    setOcDetails([]);
  };

  const saveHeader = () => {
    setSaving(true);
    setMessage(null);
    const payload = {
      ...header,
      idCliente: Number(header.idCliente),
      idProveedor: Number(header.idProveedor),
      idCampana: Number(header.idCampana),
      idProducto: Number(header.idProducto),
      idServicio: Number(header.idServicio),
      descuento: Number(header.descuento),
      iva: Number(header.iva),
      spa: Number(header.spa),
      ivaSpa: Number(header.ivaSpa),
      contrato: Number(header.contrato || 0),
    };
    const call =
      isEdit && id
        ? api.updateExternalProductionBudget(id, payload)
        : api.createExternalProductionBudget(payload);
    call
      .then((res) => {
        if (res?.success) {
          if (!isEdit && res.data?.id) {
            navigate(
              `/medios/presupuestos/produccion-externa/${res.data.id}/editar`,
              { state: { message: res.message } },
            );
            return;
          }
          setMessage({
            type: "success",
            text: res.message || "Presupuesto actualizado.",
          });
          if (id) loadBudget(id);
        } else
          setMessage({
            type: "error",
            text: res?.message || "No se pudo guardar.",
          });
      })
      .catch(() => setMessage({ type: "error", text: "No se pudo guardar." }))
      .finally(() => setSaving(false));
  };

  const saveDetail = () => {
    if (!id) {
      setMessage({
        type: "error",
        text: "Guardá primero la cabecera del presupuesto.",
      });
      return;
    }
    const rawCost =
      detail.costoIncentivo === "" ? undefined : Number(detail.costoIncentivo);
    const payload = {
      ...detail,
      idServicio: Number(detail.idServicio),
      valor: Number(detail.valor),
      iva: Number(detail.iva),
      incentivo: Number(detail.incentivo || 0),
      costoIncentivo: Number.isFinite(rawCost) ? rawCost : undefined,
    };
    const call = detail.id
      ? api.updateExternalProductionBudgetDetail(id, detail.id, payload)
      : api.addExternalProductionBudgetDetail(id, payload);
    call
      .then((res) => {
        if (res?.success) {
          setMessage({ type: "success", text: res.message });
          loadBudget(id);
        } else
          setMessage({
            type: "error",
            text: res?.message || "No se pudo guardar el detalle.",
          });
      })
      .catch(() =>
        setMessage({ type: "error", text: "No se pudo guardar el detalle." }),
      );
  };

  const searchCostOrderDetails = () => {
    if (!id || !ocId || ocLoading) return;
    setOcLoading(true);
    setMessage(null);
    api
      .getExternalProductionBudgetCostOrderDetails(id, ocId)
      .then((res) => {
        if (res?.success)
          setOcDetails(
            (res.data || []).map((row: CostOrderDetail) => ({
              ...row,
              assigned: String(Number(row.disponible || 0)),
            })),
          );
        else {
          setOcDetails([]);
          setMessage({
            type: "error",
            text: res?.message || "No se pudo consultar la orden de costo.",
          });
        }
      })
      .catch(() => {
        setOcDetails([]);
        setMessage({
          type: "error",
          text: "No se pudo consultar la orden de costo.",
        });
      })
      .finally(() => setOcLoading(false));
  };

  const setOcAssigned = (detailId: number, value: string) =>
    setOcDetails((list) =>
      list.map((row) =>
        row.idDetalle === detailId ? { ...row, assigned: value } : row,
      ),
    );
  const addCostOrderDetail = (row: CostOrderDetail) => {
    if (!id || ocSaving) return;
    const assigned = Number(row.assigned);
    setOcSaving(row.idDetalle);
    setMessage(null);
    api
      .addExternalProductionBudgetCostOrderDetail(id, {
        orderId: Number(ocId),
        orderDetailId: row.idDetalle,
        assigned,
        incentivo: Number(ocIncentive || 0),
        costoIncentivo:
          ocIncentiveCost === "" ? undefined : Number(ocIncentiveCost),
      })
      .then((res) => {
        if (res?.success) {
          setMessage({ type: "success", text: res.message });
          const created = res.data?.detail;
          setDetails((list) => [
            ...list,
            created
              ? { ...created, detalle: created.detalle ?? row.detalle, idServicio: created.idServicio ?? header.idServicio, iva: created.iva ?? header.iva }
              : {
                  id: `oc-${ocId}-${row.idDetalle}`,
                  unidad: "1",
                  idServicio: header.idServicio,
                  servicio: null,
                  detalle: row.detalle || "Sin detalle",
                  valor: assigned,
                  iva: header.iva,
                  incentivo: Number(ocIncentive || 0),
                  incentivoArea: null,
                  incentivoMedio: null,
                  valorAsignadoOc: assigned,
                  ordenCosto: Number(ocId),
                  editableCost: false,
                },
          ]);
          searchCostOrderDetails();
        } else
          setMessage({
            type: "error",
            text: res?.message || "No se pudo agregar el detalle de OC.",
          });
      })
      .catch(() =>
        setMessage({
          type: "error",
          text: "No se pudo agregar el detalle de OC.",
        }),
      )
      .finally(() => setOcSaving(null));
  };

  const deleteDetail = () => {
    if (!confirm?.id || !id) return;
    api
      .deleteExternalProductionBudgetDetail(id, confirm.id)
      .then((res) => {
        if (res?.success) {
          setMessage({ type: "success", text: res.message });
          loadBudget(id);
        } else
          setMessage({
            type: "error",
            text: res?.message || "No se pudo ejecutar la acción.",
          });
      })
      .catch(() =>
        setMessage({ type: "error", text: "No se pudo ejecutar la acción." }),
      )
      .finally(() => setConfirm(null));
  };

  const canSave =
    editable &&
    header.idCliente &&
    header.idProveedor &&
    header.idCampana &&
    header.idProducto &&
    header.idServicio;
  const canEditCost = editableCostIds.includes(Number(detail.idServicio));
  const selectedIncentive = incentives.find(
    (i) => Number(i.id) === Number(detail.incentivo),
  );
  const selectedOcIncentive = ocIncentives.find(
    (i) => Number(i.id) === Number(ocIncentive),
  );
  const money = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const incentiveCost = selectedIncentive
    ? money(detail.costoIncentivo || selectedIncentive.costo)
    : 0;
  const incentiveValue = money(detail.valor);
  const incentiveGross = incentiveValue - incentiveCost;
  const incentiveSonoPct = money(selectedIncentive?.utilidadSono);
  const incentiveProviderPct = money(selectedIncentive?.utilidadProveedor);
  const incentiveSono = (incentiveGross * incentiveSonoPct) / 100;
  const incentiveProvider = (incentiveGross * incentiveProviderPct) / 100;
  const ocIncentiveCostValue = selectedOcIncentive
    ? money(ocIncentiveCost || selectedOcIncentive.costo)
    : 0;

  if (loading)
    return (
      <div
        style={{
          padding: "80px 20px",
          textAlign: "center",
          color: "var(--muted,#64748b)",
          fontSize: 14,
        }}
      >
        Cargando presupuesto…
      </div>
    );

  return (
    <div
      style={{
        animation: "scfade .35s ease",
        maxWidth: 1180,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--muted,#64748b)",
              marginBottom: 11,
            }}
          >
            <a
              href="/medios/presupuestos/produccion-externa/listar"
              onClick={(e) => {
                e.preventDefault();
                navigate("/medios/presupuestos/produccion-externa/listar");
              }}
              style={{ color: "var(--muted,#64748b)", textDecoration: "none" }}
            >
              Presupuesto Producción Externa
            </a>
            <span style={{ color: "var(--faint,#94a3b8)" }}>›</span>
            <span style={{ color: "var(--fg-2,#334155)", fontWeight: 600 }}>
              {isEdit ? `Editar #${id}` : "Nuevo"}
            </span>
          </div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-.02em",
              margin: "0 0 5px",
              color: "var(--fg,#0f172a)",
            }}
          >
            {isEdit ? `Editar presupuesto #${id}` : "Nuevo presupuesto"}
          </h1>
          <p style={{ margin: 0, color: "var(--muted,#64748b)", fontSize: 14 }}>
            Completa cabecera, detalles e incentivos del presupuesto de
            producción externa.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() =>
              navigate("/medios/presupuestos/produccion-externa/listar")
            }
            style={button}
          >
            <Icon d="M18 6L6 18M6 6l12 12" size={16} sw={2} />
            {editable ? "Cancelar" : "Volver"}
          </button>
          {editable && (
            <button
              disabled={!canSave || saving}
              onClick={saveHeader}
              style={{
                ...button,
                background: canSave
                  ? "var(--primary,#0f172a)"
                  : "var(--border-strong,#d5d9e0)",
                color: "#fff",
                border: "none",
              }}
            >
              <Icon
                d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
                size={16}
                sw={1.8}
              />
              {saving ? "Guardando…" : "Guardar cabecera"}
            </button>
          )}
        </div>
      </div>

      {!editable && (
        <div
          style={{
            marginBottom: 16,
            padding: "11px 14px",
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 600,
            color: "#b45309",
            background: "rgba(245,158,11,.12)",
            border: "1px solid rgba(245,158,11,.22)",
          }}
        >
          Sólo lectura: legacy sólo permite modificar estado activo.
        </div>
      )}
      {message && (
        <AlertMessage type={message.type} style={{ marginBottom: 16 }}>
          {message.text}
        </AlertMessage>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.85fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "contents",
          }}
        >
          <div style={{ ...card, order: 1 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--fg,#0f172a)",
              }}
            >
              Información general
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--muted,#64748b)",
                margin: "3px 0 18px",
              }}
            >
              Datos principales del presupuesto
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px 18px",
              }}
            >
              <SearchSelect
                value={cliente}
                label="Cliente"
                placeholder="Selecciona un cliente"
                disabled={!editable}
                fetcher={(search) =>
                  api.getExternalProductionBudgetOptions("clients", { search })
                }
                onSelect={onClienteChange}
              />
              <SearchSelect
                value={proveedor}
                label="Proveedor"
                placeholder="Selecciona un proveedor"
                disabled={!editable}
                fetcher={(search) =>
                  api.getExternalProductionBudgetOptions("providers", {
                    search,
                  })
                }
                onSelect={onProveedorChange}
              />
              <div>
                <label style={label}>Servicio</label>
                <select
                  disabled={!editable}
                  value={header.idServicio}
                  onChange={(e) => {
                    setH("idServicio", e.target.value);
                    setD("idServicio", e.target.value);
                  }}
                  style={input}
                >
                  <option value="">Selecciona</option>
                  {services.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Campaña</label>
                <select
                  disabled={!editable || !header.idCliente}
                  value={header.idCampana}
                  onChange={(e) => setH("idCampana", e.target.value)}
                  style={input}
                >
                  <option value="">Selecciona</option>
                  {campaigns.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Producto</label>
                <select
                  disabled={!editable || !header.idCliente}
                  value={header.idProducto}
                  onChange={(e) => setH("idProducto", e.target.value)}
                  style={input}
                >
                  <option value="">Selecciona</option>
                  {products.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Contrato</label>
                <input
                  disabled={!editable}
                  value={header.contrato}
                  onChange={(e) =>
                    setH("contrato", e.target.value.replace(/[^0-9]/g, ""))
                  }
                  style={input}
                />
              </div>
              <div>
                <label style={label}>Orden cliente</label>
                <input
                  disabled={!editable}
                  value={header.ordenCliente}
                  onChange={(e) => setH("ordenCliente", e.target.value)}
                  style={input}
                />
              </div>
              <div>
                <label style={label}>Forma de pago</label>
                <input
                  disabled={!editable}
                  value={header.formaPago}
                  onChange={(e) => setH("formaPago", e.target.value)}
                  style={input}
                />
              </div>
              <div>
                <label style={label}>Cotización</label>
                <input
                  disabled={!editable}
                  value={header.cotizacion}
                  onChange={(e) => setH("cotizacion", e.target.value)}
                  style={input}
                />
              </div>
            </div>
            <label style={{ ...label, marginTop: 16 }}>
              Observación presupuesto
            </label>
            <textarea
              disabled={!editable}
              value={header.observacion}
              onChange={(e) => setH("observacion", e.target.value)}
              rows={3}
              style={{
                ...input,
                height: "auto",
                paddingTop: 10,
                fontFamily: "inherit",
              }}
            />
            <label style={{ ...label, marginTop: 16 }}>
              Observación orden relacionada
            </label>
            <textarea
              disabled={!editable}
              value={header.ordenObservacion}
              onChange={(e) => setH("ordenObservacion", e.target.value)}
              rows={2}
              style={{
                ...input,
                height: "auto",
                paddingTop: 10,
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ ...card, order: 3, gridColumn: "1 / -1", overflow: "visible" }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--fg,#0f172a)",
              }}
            >
              Detalles e incentivos
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--muted,#64748b)",
                margin: "3px 0 16px",
              }}
            >
              Líneas del presupuesto e incentivo relacionado
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {details.map((row) => {
                const tooltipKey = `detail-${row.id}`;
                const linkedTooltipKey = `linked-${row.id}`;
                const hasLinkedCostOrder = Number(row.ordenCosto) > 0;
                const detailText = row.detalle || "Sin detalle";
                const linkedText = hasLinkedCostOrder ? `detalle asociado a la oc #${row.ordenCosto}` : "";
                return (
                  <div key={row.id} style={{ fontSize: 13 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          editable
                            ? "minmax(220px,1fr) 68px 150px 44px 44px"
                            : "minmax(220px,1fr) 68px 150px",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          minWidth: 0,
                          zIndex: detailTooltip?.key === tooltipKey || detailTooltip?.key === linkedTooltipKey ? 20 : 1,
                        }}
                      >
                        <input
                          value={detailText}
                          readOnly
                          style={{ ...readonlyInput, paddingRight: hasLinkedCostOrder ? 72 : 42 }}
                        />
                        {(detailTooltip?.key === tooltipKey || detailTooltip?.key === linkedTooltipKey) && (
                          <div style={detailTooltipBox}>
                            {detailTooltip.text}
                          </div>
                        )}
                        {row.detalle?.trim() && (
                          <button
                            type="button"
                            aria-label="Ver detalle completo"
                            onMouseEnter={() =>
                              setDetailTooltip({ key: tooltipKey, text: detailText })
                            }
                            onMouseLeave={() =>
                              setDetailTooltip((current) =>
                                current?.key === tooltipKey ? null : current,
                              )
                            }
                            onFocus={() =>
                              setDetailTooltip({ key: tooltipKey, text: detailText })
                            }
                            onBlur={() =>
                              setDetailTooltip((current) =>
                                current?.key === tooltipKey ? null : current,
                              )
                            }
                            style={{ ...detailInfoButton, right: hasLinkedCostOrder ? 38 : 10 }}
                          >
                            <Icon
                              d={infoIconPath}
                              size={14}
                              sw={2}
                            />
                          </button>
                        )}
                        {hasLinkedCostOrder && (
                          <button
                            type="button"
                            aria-label={linkedText}
                            onMouseEnter={() =>
                              setDetailTooltip({ key: linkedTooltipKey, text: linkedText })
                            }
                            onMouseLeave={() =>
                              setDetailTooltip((current) =>
                                current?.key === linkedTooltipKey ? null : current,
                              )
                            }
                            onFocus={() =>
                              setDetailTooltip({ key: linkedTooltipKey, text: linkedText })
                            }
                            onBlur={() =>
                              setDetailTooltip((current) =>
                                current?.key === linkedTooltipKey ? null : current,
                              )
                            }
                            style={detailLinkedButton}
                          >
                            <Icon d={linkedIconPath} size={14} sw={1.8} />
                          </button>
                        )}
                      </div>
                      <input
                        value={row.unidad || "1"}
                        readOnly
                        title="Unidad"
                        style={{ ...readonlyInput, textAlign: "center" }}
                      />
                        <div style={monoTotal}>
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: "var(--muted,#64748b)",
                            textTransform: "uppercase",
                            letterSpacing: ".03em",
                          }}
                        >
                          Total
                        </div>
                        {fmtMoneyFull(Number(row.valor || 0))}
                      </div>
                      {editable && (
                        <button
                          onClick={() =>
                            setDetail({
                              id: row.id,
                              unidad: row.unidad || "1",
                              idServicio: String(row.idServicio || ""),
                              detalle: row.detalle || "",
                              valor: String(row.valor || ""),
                              iva: String(row.iva || header.iva || ""),
                              incentivo: String(row.incentivo || 0),
                              costoIncentivo:
                                row.snapshotCosto == null
                                  ? ""
                                  : String(row.snapshotCosto),
                            })
                          }
                          style={{ ...nowrapButton, width: 44, height: 44, padding: 0 }}
                          title="Editar línea"
                        >
                          <Icon
                            d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                            size={16}
                            sw={1.8}
                          />
                        </button>
                      )}
                      {editable && (
                        <button
                          onClick={() =>
                            setConfirm({
                              action: "delete-detail",
                              id: row.id,
                            })
                          }
                          style={{
                            width: 44,
                            height: 44,
                            flex: "none",
                            border: "1px solid var(--border-strong,#d5d9e0)",
                            background: "var(--surface,#fff)",
                            borderRadius: 10,
                            color: "#ef4444",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                          }}
                          title="Eliminar línea"
                        >
                          <Icon
                            d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"
                            size={16}
                            sw={1.9}
                          />
                        </button>
                      )}
                    </div>
                    {(row.servicio ||
                      row.incentivo ||
                      row.incentivoArea ||
                      row.incentivoMedio) && (
                      <div
                        style={{
                          marginTop: 5,
                          color: "var(--muted,#64748b)",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        {row.servicio && <span>Servicio: {row.servicio}</span>}
                        {(row.incentivo ||
                          row.incentivoArea ||
                          row.incentivoMedio) && (
                          <>
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 800,
                                textTransform: "uppercase",
                                letterSpacing: ".03em",
                              }}
                            >
                              Incentivo
                            </span>
                            <span>
                              {[row.incentivoArea, row.incentivoMedio]
                                .filter(Boolean)
                                .join(" ") || "Relacionado"}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {editable && (
              <div
                style={{
                  marginTop: 14,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px,1fr) 68px 130px auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                      <div
                        style={{
                          position: "relative",
                          minWidth: 0,
                          zIndex: detailTooltip?.key === "new-detail" ? 20 : 1,
                        }}
                      >
                    <textarea
                      value={detail.detalle}
                      onChange={(e) => setD("detalle", e.target.value)}
                      placeholder="Detalle"
                      rows={1}
                      style={{ ...input, minHeight: 44, padding: "11px 42px 10px 13px", resize: "vertical", lineHeight: 1.35, fontFamily: "inherit" }}
                    />
                    {detailTooltip?.key === "new-detail" && (
                      <div style={detailTooltipBox}>
                        {detailTooltip.text}
                      </div>
                    )}
                    {detail.detalle.trim() && (
                      <button
                        type="button"
                        aria-label="Ver detalle completo"
                        onMouseEnter={() =>
                          setDetailTooltip({
                            key: "new-detail",
                            text: detail.detalle,
                          })
                        }
                        onMouseLeave={() =>
                          setDetailTooltip((current) =>
                            current?.key === "new-detail" ? null : current,
                          )
                        }
                        onFocus={() =>
                          setDetailTooltip({
                            key: "new-detail",
                            text: detail.detalle,
                          })
                        }
                        onBlur={() =>
                          setDetailTooltip((current) =>
                            current?.key === "new-detail" ? null : current,
                          )
                        }
                        style={detailInfoButton}
                      >
                        <Icon
                          d={infoIconPath}
                          size={14}
                          sw={2}
                        />
                      </button>
                    )}
                  </div>
                  <input
                    value={detail.unidad}
                    onChange={(e) => setD("unidad", e.target.value)}
                    placeholder="Unidad"
                    title="Unidad"
                    style={{ ...input, textAlign: "center" }}
                  />
                  <input
                    value={detail.valor}
                    onChange={(e) =>
                      setD("valor", e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    placeholder="Valor"
                    title="Valor"
                    style={input}
                  />
                  <button
                    onClick={saveDetail}
                    style={{ ...nowrapButton, height: 44 }}
                  >
                    <Icon d="M12 5v14M5 12h14" size={16} sw={2} />
                    {detail.id ? "Actualizar línea" : "Agregar línea"}
                  </button>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      incentives.length > 0 ? "1fr 1fr" : "1fr",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  <select
                    value={detail.idServicio}
                    onChange={(e) => setD("idServicio", e.target.value)}
                    style={input}
                  >
                    <option value="">Servicio</option>
                    {services.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {incentives.length > 0 && (
                    <select
                      value={detail.incentivo}
                      onChange={(e) => setD("incentivo", e.target.value)}
                      style={input}
                    >
                      <option value="0">Sin incentivo</option>
                      {incentives.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.area} - {i.medio}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {Number(detail.incentivo) > 0 && selectedIncentive && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 12,
                      borderRadius: 10,
                      background: "var(--surface-2,#f7f8fa)",
                      fontSize: 12.5,
                      color: "var(--fg-2,#334155)",
                    }}
                  >
                    <b>{selectedIncentive.detalle || "Incentivo"}</b>
                    <div>
                      Costo:{" "}
                      {canEditCost ? (
                        <input
                          value={
                            detail.costoIncentivo ||
                            String(selectedIncentive.costo || "")
                          }
                          onChange={(e) =>
                            setD(
                              "costoIncentivo",
                              e.target.value.replace(/[^0-9.]/g, ""),
                            )
                          }
                          style={{ ...input, height: 32, marginTop: 4 }}
                        />
                      ) : (
                        fmtMoneyFull(Number(selectedIncentive.costo || 0))
                      )}
                    </div>
                    <div>Bruto: {fmtMoneyFull(incentiveGross)}</div>
                    <div>
                      Utilidad Sono: {fmtMoneyFull(incentiveSono)} (
                      {incentiveSonoPct}%)
                    </div>
                    <div>
                      Utilidad proveedor: {fmtMoneyFull(incentiveProvider)} (
                      {incentiveProviderPct}%)
                    </div>
                    {selectedIncentive.nota && (
                      <div>{selectedIncentive.nota}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {isEdit && editable && (
            <div style={{ ...card, order: 4, gridColumn: "1 / -1" }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--fg,#0f172a)",
                }}
              >
                Agregar detalle desde Orden de Costo
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--muted,#64748b)",
                  margin: "3px 0 16px",
                }}
              >
                Busca una OC externa compatible y asigna el disponible al
                presupuesto.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={ocId}
                  onChange={(e) =>
                    setOcId(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="Número de OC"
                  style={{ ...input, flex: "1 1 180px", minWidth: 0 }}
                />
                <button
                  onClick={searchCostOrderDetails}
                  disabled={!ocId || ocLoading}
                  style={{ ...nowrapButton, minWidth: 112 }}
                >
                  {ocLoading ? "Buscando…" : "Buscar OC"}
                </button>
              </div>
              {ocDetails.length > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {ocIncentives.length > 0 && (
                    <div
                      style={{
                        padding: 12,
                        border: "1px solid var(--border,#e5e8ec)",
                        borderRadius: 14,
                        background: "var(--surface-2,#f7f8fa)",
                      }}
                    >
                      <label style={label}>Incentivo para detalle desde OC</label>
                      <select
                        value={ocIncentive}
                        onChange={(e) => {
                          setOcIncentive(e.target.value);
                          setOcIncentiveCost("");
                        }}
                        style={input}
                      >
                        <option value="0">Sin incentivo</option>
                        {ocIncentives.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.area} - {i.medio}
                          </option>
                        ))}
                      </select>
                      {selectedOcIncentive && (
                        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--fg-2,#334155)" }}>
                          Costo: {selectedOcIncentive.editableCost ? (
                            <input
                              value={ocIncentiveCost || String(selectedOcIncentive.costo || "")}
                              onChange={(e) =>
                                setOcIncentiveCost(e.target.value.replace(/[^0-9.]/g, ""))
                              }
                              style={{ ...input, height: 32, marginTop: 4 }}
                            />
                          ) : (
                            fmtMoneyFull(ocIncentiveCostValue)
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {ocDetails.map((row) => {
                const assigned = Number(row.assigned);
                const available = Number(row.disponible || 0);
                const canAddOcDetail =
                  Number.isFinite(assigned) &&
                  assigned > 0 &&
                  assigned <= available &&
                  ocSaving === null;
                return (
                  <div
                    key={row.idDetalle}
                    style={{
                      padding: 12,
                      border: "1px solid var(--border,#e5e8ec)",
                      borderRadius: 14,
                      background: "var(--surface,#fff)",
                      fontSize: 13,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          marginBottom: 6,
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: "var(--muted,#64748b)",
                          textTransform: "uppercase",
                          letterSpacing: ".03em",
                        }}
                      >
                        Detalle
                      </div>
                      <textarea
                        value={row.detalle || "Sin detalle"}
                        readOnly
                        rows={3}
                        style={{
                          width: "100%",
                          minHeight: 72,
                          padding: "10px 11px",
                          borderRadius: 10,
                          border: "1px solid var(--border-strong,#d5d9e0)",
                          background: "var(--surface-2,#f7f8fa)",
                          color: "var(--fg-2,#334155)",
                          fontSize: 13,
                          outline: "none",
                          resize: "vertical",
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                          minWidth: 0,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px 110px minmax(150px,1fr) 104px",
                        gap: 10,
                        alignItems: "end",
                      }}
                    >
                      <div>
                        <label style={label}>Total</label>
                        <div
                          style={{
                            height: 38,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            padding: "0 11px",
                            borderRadius: 10,
                            border: "1px solid var(--border,#e5e8ec)",
                            background: "rgba(15,23,42,.05)",
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: "var(--fg,#0f172a)",
                            ...moneyText,
                            whiteSpace: "nowrap",
                            boxSizing: "border-box",
                          }}
                        >
                          {fmtMoneyFull(available)}
                        </div>
                      </div>
                      <div>
                        <label style={label}>Cantidad OC</label>
                        <input
                          value="1"
                          readOnly
                          style={{ ...readonlyInput, height: 38, textAlign: "center" }}
                        />
                      </div>
                      <div>
                        <label style={label}>Valor a asignar</label>
                      <input
                        value={row.assigned || ""}
                        onChange={(e) =>
                          setOcAssigned(
                            row.idDetalle,
                            e.target.value.replace(/[^0-9.]/g, ""),
                          )
                        }
                          style={{ ...input, height: 38 }}
                      />
                      </div>
                      <button
                        onClick={() => addCostOrderDetail(row)}
                        disabled={!canAddOcDetail}
                        style={{
                          ...nowrapButton,
                          height: 38,
                          minWidth: 96,
                          opacity: canAddOcDetail ? 1 : 0.55,
                          cursor: canAddOcDetail ? "pointer" : "default",
                        }}
                      >
                        {ocSaving === row.idDetalle ? "Agregando…" : "Agregar"}
                      </button>
                    </div>
                    {Number.isFinite(assigned) && assigned > available && (
                      <div style={{ marginTop: 6, color: "#b91c1c" }}>
                        El valor asignado no puede superar el disponible.
                      </div>
                    )}
                  </div>
                );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            minWidth: 0,
            order: 2,
          }}
        >
          <div style={card}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--fg,#0f172a)",
                marginBottom: 16,
              }}
            >
              Valores
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <label style={label}>Descuento %</label>
                <input
                  disabled={!editable}
                  value={header.descuento}
                  onChange={(e) =>
                    setH("descuento", e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  style={input}
                />
              </div>
              <div>
                <label style={label}>IVA %</label>
                <input
                  disabled={!editable}
                  value={header.iva}
                  onChange={(e) =>
                    setH("iva", e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  style={input}
                />
              </div>
              <div>
                <label style={label}>SPA %</label>
                <input
                  disabled={!editable}
                  value={header.spa}
                  onChange={(e) =>
                    setH("spa", e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  style={input}
                />
              </div>
              <div>
                <label style={label}>IVA SPA %</label>
                <input
                  disabled={!editable}
                  value={header.ivaSpa}
                  onChange={(e) =>
                    setH("ivaSpa", e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  style={input}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 13.5,
              }}
            >
              {[
                ["Valor", subtotal],
                ["Descuento", -descuento],
                ["IVA", iva],
                ["SPA", spa],
                ["IVA SPA", ivaSpa],
              ].map(([k, v]) => (
                <div
                  key={k as string}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "var(--fg-2,#334155)",
                  }}
                >
                  <span>{k}</span>
                  <span
                    style={{
                      ...moneyText,
                      fontWeight: 600,
                    }}
                  >
                    {fmtMoneyFull(v as number)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 10,
                  borderTop: "1px solid var(--border,#e5e8ec)",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "var(--fg,#0f172a)",
                }}
              >
                <span>Total</span>
                <span style={moneyText}>
                  {fmtMoneyFull(total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={!!confirm}
        title="Confirmar acción"
        description="Esta acción aplica el comportamiento legacy para Producción Externa."
        confirmLabel="Confirmar"
        tone="danger"
        onConfirm={deleteDetail}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
