import QuickAccessDocument from '../components/QuickAccessDocument';

const pdfUrl = '/Adjuntos/SG/CODIGO DE ETICA Y CONDUCTA SONOVISTA PUBLICIDAD.pdf';

const principles = [
  ['Transparencia', 'Desempeñar las funciones con honestidad, claridad, integridad y confiabilidad.'],
  ['Respeto', 'Mantener un trato digno con colaboradores, clientes, proveedores y terceros.'],
  ['Responsabilidad', 'Actuar con profesionalismo, compromiso y calidad en el uso eficiente de los recursos.'],
  ['Confidencialidad', 'Proteger la información de la compañía, clientes, proveedores y partes relacionadas.'],
];

export default function CodeOfEthics() {
  return (
    <QuickAccessDocument title="Código de Ética y Conducta" pdfUrl={pdfUrl}>
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--fg,#0f172a)' }}>1 - Introducción</h3>
            <p style={{ margin: 0 }}>El Código de Ética y Conducta define los parámetros generales de comportamiento de estricto cumplimiento para todo el personal de Sonovista Publicidad S.A. y sirve como guía para evaluar situaciones de ética y conducta en el funcionamiento de la empresa.</p>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--fg,#0f172a)' }}>2 - Objetivos</h3>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Regular las conductas generales bajo principios de transparencia, respeto, responsabilidad y confidencialidad.</li>
              <li>Proteger los intereses comerciales, activos e información confidencial de la compañía.</li>
              <li>Promover operaciones dentro de un marco ético y moral, previniendo conductas no alineadas.</li>
              <li>Eliminar cualquier conducta ilegal o indebida.</li>
            </ul>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--fg,#0f172a)' }}>3 - Alcance</h3>
            <p style={{ margin: 0 }}>El Código de Ética y Conducta es aplicable a todos los empleados y directivos de Sonovista Publicidad S.A.</p>
          </div>

          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--fg,#0f172a)' }}>4 - Principios éticos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
              {principles.map(([title, text]) => (
                <article key={title} style={{ border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, padding: 14, background: 'var(--surface-2,#f7f8fa)' }}>
                  <strong style={{ display: 'block', marginBottom: 6, color: 'var(--fg,#0f172a)' }}>{title}</strong>
                  <span style={{ fontSize: 13.5, color: 'var(--muted,#64748b)' }}>{text}</span>
                </article>
              ))}
            </div>
          </div>
    </QuickAccessDocument>
  );
}
