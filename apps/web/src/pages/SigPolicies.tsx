import QuickAccessDocument from '../components/QuickAccessDocument';

const pdfUrl = '/Adjuntos/SG/SIG-PO-001 POLITICAS DEL SISTEMA INTEGRADO DE GESTIÓN - signed.pdf';

export default function SigPolicies() {
  return (
    <QuickAccessDocument title="Políticas del Sistema Integrado de Gestión" pdfUrl={pdfUrl}>
      <div>
        <p style={{ margin: 0 }}>En SONOVISTA PUBLICIDAD S.A. entregamos soluciones integrales de comunicación publicitaria; ofreciendo servicios de calidad en estrategias publicitarias, diseño y producción de ideas, marketing digital, pauta en medios, activación de marcas y eventos BTL.</p>
        <p style={{ margin: '12px 0 0' }}>Nuestro objetivo es la satisfacción de nuestros clientes y partes interesadas, mediante el cumplimiento de los requisitos legales y organizacionales, asignando recursos para potenciar el desarrollo de nuestros colaboradores y apuntando siempre a la mejora continua del Sistema Integrado de Gestión.</p>
      </div>

      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--fg,#0f172a)' }}>Objetivos organizacionales</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Desarrollar estrategias creativas de publicidad, medios, eventos y marketing digital.</li>
          <li>Actualizar continuamente conocimientos y tecnologías para generar contenidos de alta calidad.</li>
          <li>Satisfacer las necesidades del cliente y cumplir los requisitos del Sistema Integrado de Gestión.</li>
          <li>Implementar acciones de mejora continua, seguridad, salud en el trabajo y responsabilidad ambiental.</li>
          <li>Promover el desarrollo del personal, estilos de vida saludable y responsabilidad social.</li>
        </ul>
      </div>
    </QuickAccessDocument>
  );
}
