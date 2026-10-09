import type { Tables } from './MockDatabase.ts';

/**
 * Initial data. Catalogs and roles copy renderia-database/seed.sql; the demo
 * users, project and floor plan exist only in the browser version.
 *
 * Demo accounts (password hashes are SHA-256 of "email:password"):
 *   admin@renderia.co       Admin123*
 *   ingeniero@renderia.co   Ingeniero123*
 *   estudiante@renderia.co  Estudiante123*
 */
export function createSeed(): Tables {
  const createdAt = '2026-10-01T14:00:00.000Z';

  return {
    roles: [
      { id: 1, name: 'Administrador', description: 'Gestiona usuarios, catálogos y modelos de IA' },
      { id: 2, name: 'Ingeniero', description: 'Crea proyectos y analiza planos estructurales' },
      { id: 3, name: 'Estudiante', description: 'Usa la plataforma con fines académicos' },
    ],
    users: [
      {
        id: 1,
        roleId: 1,
        fullName: 'Administrador Render.IA',
        email: 'admin@renderia.co',
        passwordHash: '0876ca8947d69bc6b1de6edf9fde5ad6d29d0acc08ca79644d0e4fee187d7360',
        isActive: true,
        createdAt,
      },
      {
        id: 2,
        roleId: 2,
        fullName: 'Laura Gómez',
        email: 'ingeniero@renderia.co',
        passwordHash: '2c3993e3fd47a709495bd32fa1594f6c36864b997481f3db51240b3130388de4',
        isActive: true,
        createdAt,
      },
      {
        id: 3,
        roleId: 3,
        fullName: 'Andrés Rosero',
        email: 'estudiante@renderia.co',
        passwordHash: '47150c71585402cb8f45c07c6c20a3791a9d3705f3222e0dbf9fae973af39e27',
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
        fileName: 'plano-casa.svg',
        fileUrl: '/samples/plano-casa.svg',
        floorLevel: 1,
        scale: '1:100',
        uploadedAt: createdAt,
      },
    ],
    analyses: [],
    elements: [],
    models3d: [],
    activity: [],
    sessions: [],
  };
}
