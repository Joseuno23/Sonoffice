import QuickAccessDocument from '../components/QuickAccessDocument';

const pdfUrl = '/Adjuntos/SG/ALCANCE DEL SISTEMA DE GESTIÓN DE CALIDAD.pdf';

export default function SigScope() {
  return (
    <QuickAccessDocument title="Alcance del Sistema de Gestión de Calidad" pdfUrl={pdfUrl}>
      <div>
        <p style={{ margin: 0 }}>Prestación de servicios integrales de comunicación publicitaria a través de estrategias publicitarias, marketing digital, pauta en medios, activación de marcas y eventos BTL, diseño y producción de piezas publicitarias.</p>
      </div>
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--fg,#0f172a)' }}>Exclusión aplicable</h3>
        <p style={{ margin: 0 }}>No aplica el numeral 7.1.5.2 Trazabilidad de las mediciones: la empresa no requiere equipos de medición que deban ser calibrados para verificar las características de los servicios.</p>
      </div>
    </QuickAccessDocument>
  );
}
