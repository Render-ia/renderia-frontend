import type { Tables } from './MockDatabase.ts';

/**
 * Initial data. Catalogs and roles copy renderia-database/seed.sql; the demo
 * users, project and floor plan exist only in the browser version.
 *
 * Demo accounts, one per role, have no password at all (empty hash): they are
 * entered only with the "Usar" buttons of the login, like on the real backend.
 */
export function createSeed(): Tables {
  const createdAt = '2026-10-01T14:00:00.000Z';

  return {
    roles: [
      { id: 1, name: 'Administrador', description: 'Gestiona usuarios, catálogos y modelos de IA' },
      { id: 2, name: 'Ingeniero', description: 'Crea proyectos y analiza planos estructurales' },
      { id: 3, name: 'Estudiante', description: 'Usa la plataforma con fines académicos' },
      { id: 4, name: 'Revisor', description: 'Revisa y valida los proyectos de todos, sin borrar' },
      { id: 5, name: 'Cliente', description: 'Ve los proyectos que le comparten, en modo cliente' },
    ],
    users: [
      {
        id: 1,
        roleId: 1,
        fullName: 'Administrador Render.IA',
        email: 'admin@renderia.co',
        passwordHash: '',
        isActive: true,
        createdAt,
      },
      {
        id: 2,
        roleId: 2,
        fullName: 'Laura Gómez',
        email: 'ingeniero@renderia.co',
        passwordHash: '',
        isActive: true,
        createdAt,
      },
      {
        id: 3,
        roleId: 3,
        fullName: 'Andrés Rosero',
        email: 'estudiante@renderia.co',
        passwordHash: '',
        isActive: true,
        createdAt,
      },
      {
        id: 4,
        roleId: 4,
        fullName: 'Marcela Ortiz',
        email: 'revisor@renderia.co',
        passwordHash: '',
        isActive: true,
        createdAt,
      },
      {
        id: 5,
        roleId: 5,
        fullName: 'Carlos Benavides',
        email: 'cliente@renderia.co',
        passwordHash: '',
        isActive: true,
        createdAt,
      },
    ],
    buildingTypes: [
      { id: 1, name: 'Vivienda unifamiliar', description: 'Casa para una sola familia' },
      { id: 2, name: 'Edificio residencial', description: 'Edificio de apartamentos' },
      { id: 3, name: 'Oficina', description: 'Espacio de trabajo administrativo' },
      { id: 4, name: 'Local comercial', description: 'Tienda o establecimiento de comercio' },
      { id: 5, name: 'Bodega', description: 'Espacio de almacenamiento' },
    ],
    elementTypes: [
      { id: 1, name: 'Muro', description: 'Elemento vertical que divide o soporta' },
      { id: 2, name: 'Columna', description: 'Elemento vertical que transmite cargas' },
      { id: 3, name: 'Viga', description: 'Elemento horizontal que soporta cargas' },
      { id: 4, name: 'Losa', description: 'Placa horizontal de piso o entrepiso' },
      { id: 5, name: 'Puerta', description: 'Abertura de paso en un muro' },
      { id: 6, name: 'Ventana', description: 'Abertura de luz y ventilación en un muro' },
      { id: 7, name: 'Escalera', description: 'Conexión vertical entre pisos' },
    ],
    materials: [
      { id: 1, name: 'Concreto reforzado', description: 'Concreto con acero de refuerzo' },
      { id: 2, name: 'Ladrillo', description: 'Mampostería de arcilla cocida' },
      { id: 3, name: 'Acero', description: 'Perfiles metálicos estructurales' },
      { id: 4, name: 'Madera', description: 'Elementos de madera estructural' },
      { id: 5, name: 'Drywall', description: 'Placas de yeso para divisiones livianas' },
    ],
    aiModels: [
      {
        id: 1,
        name: 'Respuesta de ejemplo',
        provider: 'mock',
        modelIdentifier: 'mock-v1',
        isActive: true,
        isDefault: false,
      },
      {
        id: 2,
        name: 'Detector de visión local',
        provider: 'local-vision',
        modelIdentifier: 'renderia-vision-v1',
        isActive: true,
        isDefault: true,
      },
    ],
    projects: [
      {
        id: 1,
        userId: 2,
        buildingTypeId: 1,
        name: 'Casa Los Andes',
        description: 'Vivienda de un piso con dos habitaciones, sala comedor, cocina y baño.',
        location: 'Pasto, Nariño',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    floorPlans: [
      {
        id: 1,
        projectId: 1,
        fileName: 'house-floor-plan.svg',
        fileUrl: '/samples/house-floor-plan.svg',
        floorLevel: 1,
        scale: '1:100',
        uploadedAt: createdAt,
      },
    ],
    projectMembers: [{ id: 1, projectId: 1, userId: 5, createdAt }],
    analyses: [],
    elements: [],
    models3d: [],
    activity: [],
    sessions: [],
  };
}
