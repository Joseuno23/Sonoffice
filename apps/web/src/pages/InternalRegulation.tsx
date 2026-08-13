import QuickAccessDocument from '../components/QuickAccessDocument';

const pdfUrl = '/Adjuntos/SG/REGLAMENTO INTERNO DEL TRABAJO V.2.cleaned.pdf';

export default function InternalRegulation() {
  return (
    <QuickAccessDocument title="Reglamento Interno" pdfUrl={pdfUrl}>
      <div>
        <p style={{ margin: 0 }}>Consulta el Reglamento Interno de Trabajo vigente de Sonovista Publicidad S.A. Este documento reúne las disposiciones internas aplicables a la relación laboral, convivencia, deberes, derechos y lineamientos disciplinarios.</p>
      </div>
      <div style={{ border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, padding: 16, background: 'var(--surface-2,#f7f8fa)', color: 'var(--muted,#64748b)', fontSize: 13.5 }}>
        Para revisar el contenido completo, usá el botón <strong>Descargar PDF</strong>.
      </div>
    </QuickAccessDocument>
  );
}
