# Registro de cambios en el código fuente

Este documento contiene los cambios realizados para mejorar el sistema.

## 1. Importación de CSV Multilingüe
- **Problema**: El mapeo automático de columnas fallaba cuando el usuario tenía la aplicación en un idioma distinto al inglés (ej. español), ya que el sistema buscaba las cabeceras traducidas.
- **Solución**: Se implementó una propiedad `englishLabel` en la configuración de cabeceras (`states.ts`) y se actualizó la lógica de emparejamiento (`Imports/index.tsx`) para usar el inglés como respaldo (fallback).
- **Impacto**: Los archivos CSV con cabeceras en inglés ahora se reconocen automáticamente sin importar el idioma de la sesión del usuario.
- **Vistas afectadas**: Todas las ventanas de importación (Órdenes de trabajo, Activos, Ubicaciones, Repuestos, Medidores, Mantenimiento Preventivo).

## 2. Optimización del Build de Docker (Frontend)
- **Problema**: Errores recurrentes de tipo `ECONNRESET` durante la instalación de paquetes con `npm` en el proceso de construcción de Docker.
- **Solución**: 
    - Se actualizó la imagen base a `node:22-alpine` para mayor estabilidad.
    - Se configuraron parámetros robustos en `npm` (`fetch-retries`, `fetch-retry-maxtimeout`, etc.) para manejar la inestabilidad de la red.
- **Impacto**: Construcción de contenedores más fiable y rápida, evitando fallos que bloqueaban el despliegue.

## 3. Documentación Interna
- Se han añadido comentarios detallados en español dentro de los archivos modificados tanto en frontend como en backend:
    - **Frontend**: `Dockerfile`, `states.ts`, `Imports/index.tsx`.
    - **Backend**: `AssetRepository.java`, `AssetService.java`.
- El objetivo es explicar la lógica de los cambios (soporte multilingüe, resiliencia de red y jerarquía contextual) para facilitar el mantenimiento futuro.

## 4. Corrección de Jerarquía en Importación de Activos (EBAR.csv)
- **Problema**: Registros huérfanos y mala asociación de la jerarquía cuando existen activos con el mismo nombre en diferentes ubicaciones.
- **Solución**:
    - Se implementó una clave compuesta (**Nombre + Ubicación**) para el ordenamiento de activos antes de la importación (`AssetService.orderAssets`).
    - Se modificó la asociación de padres (`AssetService.importAsset`) para que busque el activo padre dentro de la **misma ubicación** que el activo hijo, garantizando la unicidad.
    - Se añadió el método `findByNameIgnoreCaseAndLocation_IdAndCompany_Id` en `AssetRepository`.
- **Impacto**: Importación perfecta de estructuras complejas incluso con nombres duplicados entre sitios, eliminando registros huérfanos.
## 5. Búsqueda Global Insensible a Acentos y Ordenación A-Z
- **Problema**: Las búsquedas eran sensibles a tildes (ej. "estacion" no encontraba "Estación") y el orden inicial de las listas no era alfabético.
- **Solución**:
    - **Backend/DB**: Se habilitó la extensión `unaccent` en PostgreSQL y se integró en `WrapperSpecification.java` para normalizar tanto los campos como los términos de búsqueda.
    - **Frontends (Web & Mobile)**: Se ajustó el `initialCriteria` en Activos, Órdenes de Trabajo y Repuestos/Localizaciones para ordenar por nombre/título de forma ascendente (A-Z) por defecto.
- **Impacto**: Una experiencia de usuario más intuitiva y consistente en todas las plataformas, eliminando la fricción de buscar con o sin tildes.
### Búsqueda Extendida de Activos (Localización y Resultados Totales)
- **Problema**: La búsqueda fallaba al usar campos anidados (`location.name`), mostraba solo 10 resultados y a veces no actualizaba los datos debido a cierres obsoletos (`stale closures`) en React.
- **Solución**:
  - **Backend**: Se refactorizó `WrapperSpecification.java` para usar `getFieldPath` en todas las operaciones, habilitando la navegación por puntos (`dot notation`) en criterios de búsqueda.
  - **Utilidades**: Se creó `getNewCriteriaOnSearch` como función pura para evitar mutaciones accidentales en los campos de búsqueda.
  - **Frontend (Web & Mobile)**: Se implementaron actualizaciones funcionales (`setCriteria(prev => ...)`) para garantizar que la búsqueda siempre utilice el estado más reciente del sistema, solucionando el bug del debounce.
  - **Web**: Se fuerza `pageSize: 1000` dinámicamente durante la búsqueda para asegurar la visualización de todos los resultados.
- **Impacto**: Búsqueda robusta, rápida y capaz de encontrar activos por su ubicación física, mostrando todos los resultados coincidentes de forma inmediata.

## 6. Filtrado de Localizaciones Leaf-Only (Nodos Hoja)
- **Problema**: Los usuarios necesitaban seleccionar localizaciones finales (sin hijos) para asignar activos u órdenes de trabajo, pero el sistema mostraba toda la jerarquía, complicando la selección.
- **Solución**:
    - **Backend**: Se añadió el campo `hasChildren` a `LocationMiniDTO` y `LocationShowDTO`. Se actualizó `LocationMapper` para calcular este valor en tiempo real y se forzó el ordenamiento **A-Z** en el endpoint `/locations/mini`.
    - **Frontend (Web/Mobile)**: Se introdujo la propiedad `leafOnly` en la interfaz `IField`.
    - **Web**: `SelectLocationModal` y `CustomSelect2` ahora filtran dinámicamente según `leafOnly`. Cuando está activo, se desactiva la vista jerárquica para mostrar una lista plana más eficiente.
- **Impacto**: Selección de ubicaciones mucho más limpia y precisa, reduciendo errores humanos al asignar elementos a nodos intermedios de la jerarquía.

## 7. Optimización de Resultados en Filtros Avanzados
- **Problema**: Al usar la opción de "Filtro" (Drawer) en la vista de activos, el sistema limitaba la visualización a los primeros 10 resultados, ocultando el resto.
- **Solución**:
    - Se modificó `onFilterChange` en `Assets/index.tsx` para detectar la aplicación de filtros y establecer dinámicamente un `pageSize: 1000`.
- **Impacto**: Los usuarios ahora pueden ver todos los resultados que coinciden con sus criterios de filtrado avanzado sin necesidad de paginación manual para búsquedas pequeñas/medianas.

## 8. Rediseño de Vista Jerárquica de Activos (Estilo Lista)
- **Archivo modificado:** `frontend/src/content/own/Locations/LocationDetails.tsx`
- **Cambio:** Se reemplazó la implementación basada en `CustomDataGrid` por un componente de `List` recursivo personalizado.
- **Motivación:** 
    - Eliminar el aviso de "Missing license key" derivado de usar `@mui/x-data-grid-pro`.
    - Lograr una fidelidad visual del 100% con el diseño solicitado (Imagen `esta.png`), que requiere un aspecto de lista pura, sin cabeceras ni bordes de tabla.
- **Lógica:** Implementada una reconstrucción de árbol real y un componente `RecursiveAssetItem` que permite expandir/colapsar niveles con indentación variable.
- **Mejoras:** Combinación de nombre y fecha en un solo bloque visual, optimización de velocidad con `useMemo` y documentación interna en español.

## 9. Filtrado de Ubicaciones en Creación de OTs
- **Archivo modificado:** `frontend/src/content/own/WorkOrders/index.tsx`
- **Cambio:** Se añadió la propiedad `leafOnly: true` al campo `location` en el formulario de creación y edición.
- **Impacto:** El selector de ubicación ahora filtra automáticamente para mostrar únicamente los nodos hijos (ubicaciones finales), consistente con el resto de la aplicación.

## 10. Selección Jerárquica de Activos en OTs
- **Archivos modificados:** 
    - `frontend/src/content/own/components/form/SelectAssetModal.tsx`
    - `frontend/src/content/own/components/form/CustomSelect2.tsx`
- **Cambios realizados:**
    1. **Refactorización del componente recursivo:**
        - Se movió `RecursiveAssetSelectionItem` fuera del componente principal para evitar pérdida de estado en re-renders.
        - **Impacto:** Mejora la estabilidad del estado `expanded` y el rendimiento general.
    
    2. **Corrección de indentación visual:**
        - Se cambió `pl: depth * 2` a `pl: depth * 4` para coincidir con `LocationDetails.tsx`.
        - Se eliminó el `pl: 2` extra del componente `Collapse` que interfería con la jerarquía.
        - **Impacto:** Jerarquía visual clara y consistente con el resto de la aplicación.
    
    3. **Algoritmo de preservación de ancestros (path-preserving):**
        - Se implementó lógica para incluir automáticamente los padres de activos que coinciden con la búsqueda.
        - Se evita que los activos aparezcan como "huérfanos" en la raíz cuando se aplican filtros.
        - **Impacto:** Mantiene el contexto jerárquico completo, facilitando la navegación.
    
    4. **Mejora de UX - Apertura del modal:**
        - Se agregó `onClick` al `TextField` del campo de activos en `CustomSelect2.tsx`.
        - El modal ahora se abre al hacer clic en cualquier parte del campo, no solo en el icono de búsqueda.
        - **Impacto:** Experiencia de usuario más intuitiva y acceso directo al árbol jerárquico.

- **Funcionalidad final:**
    - Filtrado automático por la ubicación seleccionada en el formulario.
    - Presentación en forma de árbol expandible/colapsable.
    - Diseño consistente con `LocationDetails.tsx`.
    - Búsqueda local dentro del modal que preserva la jerarquía.
    - Ordenamiento alfabético automático.


## 11. Solución al Error de Creación de Usuarios "Index: 0, Size: 0"
- **Problema**: Al crear un usuario como administrador, el sistema fallaba con `IndexOutOfBoundsException` porque intentaba acceder a una invitación inexistente (`userInvitations.get(0)`).
- **Solución**:
    - **Backend**: 
        - Se creó un nuevo método `createMember` en `UserService` que omite la lógica de invitaciones.
        - Se expuso un endpoint seguro `/users/create` en `UserController` exclusivo para administradores.
    - **Frontend**:
        - Se creó la acción `createUserMember` en Redux (`user.ts`).
        - Se modificó `CreateUser.tsx` para usar esta acción directa.
        - Se adaptó `RegisterJWT.tsx` para aceptar un manejador `onSubmit` personalizado.
- **Impacto**: Los administradores ahora pueden crear usuarios directamente sin errores, manteniendo la integridad de los datos y la seguridad (verificación de permisos y límites de suscripción).

## 12. Funcionalidades de Gestión de Usuarios (Desactivación y Edición de Email)
- **Problema**: Necesidad de desactivar usuarios temporalmente y corregir emails manualmente, manteniendo consistencia visual.
- **Solución**:
    - **Backend**: Implementada lógica de deactivatedUntil y validación de unicidad de email.
    - **Frontend**: Integrado DeactivateUserDialog con selector de fecha, switch de filtrado exclusivo y edición de email en el modal.
- **Impacto**: Mayor flexibilidad operativa para administradores y recuperación de funcionalidades legacy.

## 13. Corrección Crítica: Login Fallido
- **Problema**: Imposibilidad de ingreso con usuarios existentes.
- **Causa Raíz**: El archivo de migración Liquibase 2025_12_18_1766060000_add_deactivatedUntil_to_ownUser.xml fue creado pero no se registró en db/master.xml.
- **Solución**: Se añadió la etiqueta <include> faltante en master.xml para asegurar la creación de la columna deactivated_until.

## 14. Reactivación y Eliminación de Usuarios
- **Archivos modificados:**
    - `UserService.java`: Corrección en `enableUser` para restaurar emails de usuarios con soft-delete.
    - `People.tsx`: Refactorización de la lógica de acciones para mostrar el botón "Habilitar" correctamente en usuarios inactivos y permitir la eliminación lógica.
- **Lógica:**
    - Al habilitar a un usuario que posee un email modificado (ej: `usuario@email.com _ ID`), el sistema ahora elimina el sufijo automáticamente, permitiendo que el usuario pueda volver a iniciar sesión.
    - La columna de acciones es ahora más dinámica, separando las acciones permitidas según el estado del usuario (activo/inactivo) y su relación con la compañía (propietario).
- **Impacto:** Recuperación total de usuarios "eliminados" accidentalmente y flujo de gestión de estados más coherente.

## 15. Localización Integral al Español (i18n)
- **Archivos modificados:**
    - `es.ts` / `en.ts`: Adición de más de 20 claves de traducción faltantes.
    - `RegisterJWT.tsx`, `InviteUserDialog.tsx`, `DeactivateUserDialog.tsx`: Reemplazo de cadenas en inglés hardcodeadas por funciones `t()`.
- **Mejoras:**
    - Traducción completa del flujo de desactivación (permanente vs temporal).
    - Mensajes de error de validación de email ahora en español.
    - Unificación de claves de roles (ej: `VIEW_ONLY_name`) para evitar inconsistencias visuales.
- **Impacto:** Aplicación profesional 100% traducida al español, mejorando la adopción por parte de usuarios hispanohablantes.
## 16. Refinamiento de Búsqueda y Ordenación (Móvil)
- **Problema**: Las búsquedas locales en los modales de selección eran sensibles a acentos y mayúsculas. Además, las localizaciones y otros elementos no se mostraban ordenados alfabéticamente por defecto.
- **Solución**:
    - **Utilidad de Normalización**: Se creó [strings.ts](file:///c:/lusardi1943/Antigravity/cmms-22-12-2025-V1.0.33/mobile/utils/strings.ts) para eliminar acentos y diacríticos, permitiendo búsquedas como "estacion" para encontrar "Estación".
    - **Ordenación A-Z**: Se forzó la ordenación alfabética ascendente en la pantalla de Localizaciones y en todos los modales de selección (Usuarios, Repuestos, Activos, Clientes, Vendedores, etc.).
    - **Mejora de UI**: Se añadieron barras de búsqueda en modales que carecían de ellas (Vendedores, Clientes, Categorías, Medidores, Equipos) para una experiencia consistente.
    - **Corrección de Modelo**: Se añadió `sortField` a `SearchCriteria` en el modelo de página del móvil para alinearlo con las capacidades del backend.
- **Impacto**: Una navegación mucho más fluida y profesional en la aplicación móvil, con datos siempre organizados y una búsqueda extremadamente flexible.

## 17. Búsqueda de Activos por Ubicación (Móvil)
- **Problema**: Los usuarios necesitaban encontrar activos buscando por el nombre de su ubicación, especialmente en los selectores de activos (modales).
- **Solución**:
    - **Backend**: Se añadió `locationName` a `AssetMiniDTO` y se actualizó `AssetMapper` para poblar este campo automáticamente desde la entidad `Location`.
    - **Frontend (Mobile)**: 
        - Se actualizó el modelo `AssetMiniDTO` para incluir `locationName`.
        - Se modificó `SelectAssetsModal.tsx` para que el filtro de búsqueda incluya tanto el nombre del activo como el nombre de su ubicación.
        - Se mejoró la interfaz del modal para mostrar el nombre de la ubicación debajo del nombre del activo, facilitando su identificación.
- **Impacto**: Mayor eficiencia para el personal de campo, permitiendo localizar activos rápidamente basándose en su ubicación física sin necesidad de conocer el nombre exacto del activo.

## 18. Eliminación de Caché de Búsqueda (Móvil)
- **Problema**: Al realizar una nueva búsqueda o cambiar un filtro, la aplicación mostraba los resultados anteriores hasta que llegaban los nuevos, creando confusión y dando la sensación de que la búsqueda no se actualizaba.
- **Solución**:
    - Se implementaron reducers de limpieza (`clearAssets`, `clearWorkOrders`, etc.) en los slices principales de Redux.
    - Se actualizaron los thunks de búsqueda para invocar esta limpieza automáticamente al iniciar una nueva petición (página 0).
    - **Refinamiento (Navegación)**: Se añadieron `useEffect` en las pantallas de Activos y Ubicaciones para invocar la limpieza al entrar (`onMount`).
    - **Refinamiento (Limpieza de Query)**: Se modificó `onQueryChange` para que, si el usuario vacía la caja de búsqueda, se limpie la caché inmediatamente y se regrese a la vista de jerarquía.
    - Se resolvió un conflicto de nombres entre thunks y acciones exportando estas últimas bajo los namespaces `assetActions` y `locationActions`.
    - **Corrección Backend (Permisos)**: Se corrigió un error en `LocationController.java` donde se verificaba el permiso de activos en lugar de localizaciones para la búsqueda.
    - **Corrección Backend (Búsqueda Robusta)**: Se ajustó `WrapperSpecification.java` para aplicar `unaccent` y `lower` solo a campos de texto, evitando errores en campos numéricos (como ID de empresa) que provocaban resultados vacíos.
    - **Corrección Frontend (Sincronización)**: Se añadieron dependencias de `view` en los `useEffect` de búsqueda y se implementaron actualizaciones funcionales de estado (`prevCriteria`) para evitar cierres obsoletos (stale closures) durante el debounce.
- **Impacto**: Mejora significativa en la percepción de velocidad y precisión del sistema. El usuario ahora ve siempre un estado "fresco" al entrar en una sección o al borrar sus términos de búsqueda, eliminando la confusión por resultados antiguos y asegurando que las búsquedas siempre se ejecuten correctamente.
## 19. Refinamiento de Lógica de Búsqueda y Visibilidad (Activos/OTs)
- **Problema**: 
    1. En la pantalla principal de Activos móvil, aunque la búsqueda técnica funcionaba, las tarjetas no mostraban el nombre de la ubicación, dificultando la verificación visual por parte del usuario.
    2. Existía una inconsistencia entre la búsqueda de Activos y la de Órdenes de Trabajo, donde esta última no permitía buscar por nombre de activo o ubicación.
- **Solución**:
    - **Backend (Solución Raíz)**: Se identificó que `AssetMapper` no incluía `LocationMapper.class` en sus dependencias, lo que resultaba en que el objeto `location` fuera `null` en los resultados de búsqueda de la pantalla principal. Se añadió la dependencia al mapper.
    - **Frontend (Mobile)**:
        - Se actualizó `WorkOrdersScreen.tsx` para incluir `asset.name` y `location.name` en los campos de búsqueda, unificando la experiencia con la pantalla de Activos.
        - Se añadieron comentarios aclaratorios sobre el impacto de estos campos en la usabilidad para el técnico de campo.
- **Impacto**: Experiencia de usuario consistente y robusta. Ahora el técnico puede encontrar cualquier Órden de Trabajo simplemente buscando el nombre del equipo o del sitio, y en la pantalla de Activos, tiene confirmación visual inmediata de la ubicación de cada equipo listado.

## 20. Ordenación Predeterminada de Activos por Ubicación (A-Z)
- **Problema**: Los técnicos prefieren ver los activos agrupados por su ubicación física para planificar mejor sus rutas, en lugar de una lista alfabética por nombre de equipo que mezcla diferentes sitios.
- **Solución**:
    - **Frontend (Mobile)**:
        - Se actualizó `AssetsScreen.tsx` para que el `sortField` predeterminado sea `location.name`.
        - Se modificó la lógica de ordenación local en `SelectAssetsModal.tsx` para priorizar `locationName` seguido del nombre del activo.
    - **Frontend (Web)**:
        - Se ajustó la configuración de `initialCriteria` en la pantalla de Activos para usar `location.name` como campo de ordenación por defecto.
- **Impacto**: Mayor eficiencia operativa. Los técnicos ahora ven sus activos organizados por sitio de forma natural, tanto en la lista principal como al seleccionar activos para nuevas Órdenes de Trabajo.
## 21. Navegación Directa de Ubicación (Hoja) a Activos
- **Problema**: Al llegar al último nivel de la jerarquía de ubicaciones, el usuario debía salir e ir a la sección de Activos para buscar los equipos de ese sitio, rompiendo el flujo de navegación.
- **Solución**:
    - **Backend (API)**: Se extendió el endpoint `/assets/children/{id}` para aceptar un parámetro `locationId`. Cuando se solicita la raíz (`id=0`) con una ubicación, el sistema devuelve solo los activos padre de ese sitio específico.
    - **Frontend (Mobile)**:
        - Se actualizó el thunk `getAssetChildren` para soportar el filtrado por ubicación.
        - Se añadió el botón **"Ver activos"** en la pestaña de Detalles de ubicación, visible únicamente para nodos hoja (`!hasChildren`).
        - La pantalla de Activos ahora puede recibir un contexto de ubicación, ajustando su título dinámicamente (ej. "Activos - Planta A").
- **Impacto**: Navegación fluida y contextual. El técnico puede explorar la infraestructura física y, al encontrar el punto de interés, saltar directamente a la gestión de sus equipos asociados sin perder el contexto.

## 22. Refinamiento de Jerarquía y Búsqueda de Activos (Móvil)
- **Problema**: 
    1. Los activos que tenían un "padre" en una ubicación diferente (ej. padre en un sitio superior o centralizado) no aparecían como raíces al filtrar por una ubicación específica, lo que causaba que la lista pareciera incompleta.
    2. Al realizar búsquedas dentro de una ubicación específica, los resultados incluían activos de todo el sistema, rompiendo el aislamiento de sitio.
- **Solución**:
    - **Backend (JPQL)**: Se actualizó `AssetRepository` para identificar "raíces locales". Un activo se considera raíz para una ubicación si no tiene padre O si su padre pertenece a una ubicación diferente. También se añadió la exclusión explícita de activos archivados (`archived = false`).
    - **Frontend (Mobile)**:
        - Se actualizó `AssetsScreen.tsx` para inicializar y preservar el filtro de `location.id` en los criterios de búsqueda global. 
        - **Impacto**: Las búsquedas ahora respetan el contexto de la ubicación actual.
    - **Optimización de Mappers**: Se introdujo `toMiniDto` sin contexto en `LocationMapper` para permitir que MapStruct asocie correctamente los datos de ubicación en `AssetShowDTO` sin necesidad de propagar `LocationService` por todo el backend, simplificando el código y evitando errores de compilación.
- **Impacto**: Visualización completa y precisa de la jerarquía de activos por sitio, asegurando que el personal de campo vea todos los equipos relevantes y que las búsquedas se mantengan dentro de su área de trabajo actual.

## 23. Optimización Final de Jerarquía y Rendimiento (Móvil)
- **Problema**: 
    1. Lentitud significativa al navegar por la jerarquía de activos en el móvil.
    2. Resultados vacíos al intentar ver activos desde una ubicación específica debido a una lógica de filtrado demasiado restrictiva o inconsistente.
- **Solución**:
    - **Backend (API)**:
        - Se optimizó `AssetController.java` para que, al solicitar la raíz de una ubicación (`id=0`), devuelva todos los activos de una vez (hasta 5000) omitiendo la paginación restrictiva de 10 elementos.
        - Se añadió registro detallado (`@Slf4j`) para monitorear la entrega de resultados desde el servidor.
    - **Backend (Repositorio)**:
        - Se simplificó la consulta en `AssetRepository.java` para asegurar la entrega de todos los activos sin padre directo que pertenecen al sitio solicitado.
    - **Frontend (Mobile)**:
        - Se optimizó `AssetsScreen.tsx` eliminando efectos secundarios redundantes y re-renders innecesarios.
        - Se implementó un indicador de **"Cargando..."** y un mensaje de **"Sin resultados"** para mejorar la retroalimentación al usuario.
        - La app ahora confía plenamente en el filtrado realizado por el servidor para el primer nivel de la jerarquía, lo que agiliza drásticamente la visualización.
- **Impacto**: Una experiencia de navegación instantánea y fiable. El personal de campo puede encontrar sus equipos en segundos sin esperas ni pantallas vacías, garantizando que el diseño jerárquico sea funcional y eficiente en condiciones reales de uso.

## 24. Pre-poblamiento de Contexto en Órdenes de Trabajo (Móvil)
- **Problema**: Al crear una nueva Orden de Trabajo desde el móvil, los campos de "Ubicación" y "Activo" aparecían vacíos aunque el usuario estuviera viendo el detalle de un equipo o sitio específico, obligándole a re-seleccionar los datos.
- **Solución**:
    - **Detección de Pantalla Activa**: Se actualizó el botón global (+) (`CreateEntitiesSheet.tsx`) para identificar si el usuario está en `AssetDetails`, `LocationDetails` o una lista de `Assets` filtrada, pasando automáticamente estos datos al formulario de creación.
    - **Derivación de Ubicación**: En `CreateWorkOrderScreen.tsx`, se implementó lógica para que, si se selecciona un activo, el sistema auto-complete la ubicación asociada al equipo.
    - **Navegación Contextual**: Se aseguraron las referencias cruzadas en los menús de detalles para mantener la integridad de los datos durante la creación.
- **Impacto**: Reducción significativa de clics y errores humanos. El técnico puede ahora saltar directamente de la inspección de un equipo a la creación de su orden de mantenimiento con toda la información relevante ya pre-cargada.

## 25. Ordenación de Activos por Nombre de Ubicación (Móvil)
- **Problema**: Los activos se mostraban en un orden inconsistente (a veces por ID o nombre de activo), lo que dificultaba al personal de campo encontrar equipos que están físicamente en la misma zona.
- **Solución**:
    - **Ordenación en Frontend**: Se implementó una lógica de ordenamiento personalizada en `AssetsScreen.tsx` que fuerza la organización de la A a la Z basándose en `asset.location.name`.
    - **Criterio Secundario**: En casos donde los activos pertenecen a la misma ubicación, se aplica un orden alfabético por el nombre del activo para mantener la coherencia.
    - **Consistencia Global**: El cambio afecta tanto a la navegación por jerarquías (carpetas) como a los resultados de búsqueda en modo lista.
- **Impacto**: Organización optimizada para el trabajo en campo. Los técnicos visualizan los equipos agrupados de forma natural por su ubicación física, mejorando la velocidad de operación.
