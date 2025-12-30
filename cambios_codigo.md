# Registro de cambios en el cÃ³digo fuente

Este documento contiene los cambios realizados para mejorar el sistema.

## 1. ImportaciÃ³n de CSV MultilingÃ¼e
- **Problema**: El mapeo automÃ¡tico de columnas fallaba cuando el usuario tenÃ­a la aplicaciÃ³n en un idioma distinto al inglÃ©s (ej. espaÃ±ol), ya que el sistema buscaba las cabeceras traducidas.
- **SoluciÃ³n**: Se implementÃ³ una propiedad `englishLabel` en la configuraciÃ³n de cabeceras (`states.ts`) y se actualizÃ³ la lÃ³gica de emparejamiento (`Imports/index.tsx`) para usar el inglÃ©s como respaldo (fallback).
- **Impacto**: Los archivos CSV con cabeceras en inglÃ©s ahora se reconocen automÃ¡ticamente sin importar el idioma de la sesiÃ³n del usuario.
- **Vistas afectadas**: Todas las ventanas de importaciÃ³n (Ã“rdenes de trabajo, Activos, Ubicaciones, Repuestos, Medidores, Mantenimiento Preventivo).

## 2. OptimizaciÃ³n del Build de Docker (Frontend)
- **Problema**: Errores recurrentes de tipo `ECONNRESET` durante la instalaciÃ³n de paquetes con `npm` en el proceso de construcciÃ³n de Docker.
- **SoluciÃ³n**: 
    - Se actualizÃ³ la imagen base a `node:22-alpine` para mayor estabilidad.
    - Se configuraron parÃ¡metros robustos en `npm` (`fetch-retries`, `fetch-retry-maxtimeout`, etc.) para manejar la inestabilidad de la red.
- **Impacto**: ConstrucciÃ³n de contenedores mÃ¡s fiable y rÃ¡pida, evitando fallos que bloqueaban el despliegue.

## 3. DocumentaciÃ³n Interna
- Se han aÃ±adido comentarios detallados en espaÃ±ol dentro de los archivos modificados tanto en frontend como en backend:
    - **Frontend**: `Dockerfile`, `states.ts`, `Imports/index.tsx`.
    - **Backend**: `AssetRepository.java`, `AssetService.java`.
- El objetivo es explicar la lÃ³gica de los cambios (soporte multilingÃ¼e, resiliencia de red y jerarquÃ­a contextual) para facilitar el mantenimiento futuro.

## 4. CorrecciÃ³n de JerarquÃ­a en ImportaciÃ³n de Activos (EBAR.csv)
- **Problema**: Registros huÃ©rfanos y mala asociaciÃ³n de la jerarquÃ­a cuando existen activos con el mismo nombre en diferentes ubicaciones.
- **SoluciÃ³n**:
    - Se implementÃ³ una clave compuesta (**Nombre + UbicaciÃ³n**) para el ordenamiento de activos antes de la importaciÃ³n (`AssetService.orderAssets`).
    - Se modificÃ³ la asociaciÃ³n de padres (`AssetService.importAsset`) para que busque el activo padre dentro de la **misma ubicaciÃ³n** que el activo hijo, garantizando la unicidad.
    - Se aÃ±adiÃ³ el mÃ©todo `findByNameIgnoreCaseAndLocation_IdAndCompany_Id` en `AssetRepository`.
- **Impacto**: ImportaciÃ³n perfecta de estructuras complejas incluso con nombres duplicados entre sitios, eliminando registros huÃ©rfanos.
## 5. BÃºsqueda Global Insensible a Acentos y OrdenaciÃ³n A-Z
- **Problema**: Las bÃºsquedas eran sensibles a tildes (ej. "estacion" no encontraba "EstaciÃ³n") y el orden inicial de las listas no era alfabÃ©tico.
- **SoluciÃ³n**:
    - **Backend/DB**: Se habilitÃ³ la extensiÃ³n `unaccent` en PostgreSQL y se integrÃ³ en `WrapperSpecification.java` para normalizar tanto los campos como los tÃ©rminos de bÃºsqueda.
    - **Frontends (Web & Mobile)**: Se ajustÃ³ el `initialCriteria` en Activos, Ã“rdenes de Trabajo y Repuestos/Localizaciones para ordenar por nombre/tÃ­tulo de forma ascendente (A-Z) por defecto.
- **Impacto**: Una experiencia de usuario mÃ¡s intuitiva y consistente en todas las plataformas, eliminando la fricciÃ³n de buscar con o sin tildes.
### BÃºsqueda Extendida de Activos (LocalizaciÃ³n y Resultados Totales)
- **Problema**: La bÃºsqueda fallaba al usar campos anidados (`location.name`), mostraba solo 10 resultados y a veces no actualizaba los datos debido a cierres obsoletos (`stale closures`) en React.
- **SoluciÃ³n**:
  - **Backend**: Se refactorizÃ³ `WrapperSpecification.java` para usar `getFieldPath` en todas las operaciones, habilitando la navegaciÃ³n por puntos (`dot notation`) en criterios de bÃºsqueda.
  - **Utilidades**: Se creÃ³ `getNewCriteriaOnSearch` como funciÃ³n pura para evitar mutaciones accidentales en los campos de bÃºsqueda.
  - **Frontend (Web & Mobile)**: Se implementaron actualizaciones funcionales (`setCriteria(prev => ...)`) para garantizar que la bÃºsqueda siempre utilice el estado mÃ¡s reciente del sistema, solucionando el bug del debounce.
  - **Web**: Se fuerza `pageSize: 1000` dinÃ¡micamente durante la bÃºsqueda para asegurar la visualizaciÃ³n de todos los resultados.
- **Impacto**: BÃºsqueda robusta, rÃ¡pida y capaz de encontrar activos por su ubicaciÃ³n fÃ­sica, mostrando todos los resultados coincidentes de forma inmediata.

## 6. Filtrado de Localizaciones Leaf-Only (Nodos Hoja)
- **Problema**: Los usuarios necesitaban seleccionar localizaciones finales (sin hijos) para asignar activos u Ã³rdenes de trabajo, pero el sistema mostraba toda la jerarquÃ­a, complicando la selecciÃ³n.
- **SoluciÃ³n**:
    - **Backend**: Se aÃ±adiÃ³ el campo `hasChildren` a `LocationMiniDTO` y `LocationShowDTO`. Se actualizÃ³ `LocationMapper` para calcular este valor en tiempo real y se forzÃ³ el ordenamiento **A-Z** en el endpoint `/locations/mini`.
    - **Frontend (Web/Mobile)**: Se introdujo la propiedad `leafOnly` en la interfaz `IField`.
    - **Web**: `SelectLocationModal` y `CustomSelect2` ahora filtran dinÃ¡micamente segÃºn `leafOnly`. Cuando estÃ¡ activo, se desactiva la vista jerÃ¡rquica para mostrar una lista plana mÃ¡s eficiente.
- **Impacto**: SelecciÃ³n de ubicaciones mucho mÃ¡s limpia y precisa, reduciendo errores humanos al asignar elementos a nodos intermedios de la jerarquÃ­a.

## 7. OptimizaciÃ³n de Resultados en Filtros Avanzados
- **Problema**: Al usar la opciÃ³n de "Filtro" (Drawer) en la vista de activos, el sistema limitaba la visualizaciÃ³n a los primeros 10 resultados, ocultando el resto.
- **SoluciÃ³n**:
    - Se modificÃ³ `onFilterChange` en `Assets/index.tsx` para detectar la aplicaciÃ³n de filtros y establecer dinÃ¡micamente un `pageSize: 1000`.
- **Impacto**: Los usuarios ahora pueden ver todos los resultados que coinciden con sus criterios de filtrado avanzado sin necesidad de paginaciÃ³n manual para bÃºsquedas pequeÃ±as/medianas.

## 8. RediseÃ±o de Vista JerÃ¡rquica de Activos (Estilo Lista)
- **Archivo modificado:** `frontend/src/content/own/Locations/LocationDetails.tsx`
- **Cambio:** Se reemplazÃ³ la implementaciÃ³n basada en `CustomDataGrid` por un componente de `List` recursivo personalizado.
- **MotivaciÃ³n:** 
    - Eliminar el aviso de "Missing license key" derivado de usar `@mui/x-data-grid-pro`.
    - Lograr una fidelidad visual del 100% con el diseÃ±o solicitado (Imagen `esta.png`), que requiere un aspecto de lista pura, sin cabeceras ni bordes de tabla.
- **LÃ³gica:** Implementada una reconstrucciÃ³n de Ã¡rbol real y un componente `RecursiveAssetItem` que permite expandir/colapsar niveles con indentaciÃ³n variable.
- **Mejoras:** CombinaciÃ³n de nombre y fecha en un solo bloque visual, optimizaciÃ³n de velocidad con `useMemo` y documentaciÃ³n interna en espaÃ±ol.

## 9. Filtrado de Ubicaciones en CreaciÃ³n de OTs
- **Archivo modificado:** `frontend/src/content/own/WorkOrders/index.tsx`
- **Cambio:** Se aÃ±adiÃ³ la propiedad `leafOnly: true` al campo `location` en el formulario de creaciÃ³n y ediciÃ³n.
- **Impacto:** El selector de ubicaciÃ³n ahora filtra automÃ¡ticamente para mostrar Ãºnicamente los nodos hijos (ubicaciones finales), consistente con el resto de la aplicaciÃ³n.

## 10. SelecciÃ³n JerÃ¡rquica de Activos en OTs
- **Archivos modificados:** 
    - `frontend/src/content/own/components/form/SelectAssetModal.tsx`
    - `frontend/src/content/own/components/form/CustomSelect2.tsx`
- **Cambios realizados:**
    1. **RefactorizaciÃ³n del componente recursivo:**
        - Se moviÃ³ `RecursiveAssetSelectionItem` fuera del componente principal para evitar pÃ©rdida de estado en re-renders.
        - **Impacto:** Mejora la estabilidad del estado `expanded` y el rendimiento general.
    
    2. **CorrecciÃ³n de indentaciÃ³n visual:**
        - Se cambiÃ³ `pl: depth * 2` a `pl: depth * 4` para coincidir con `LocationDetails.tsx`.
        - Se eliminÃ³ el `pl: 2` extra del componente `Collapse` que interferÃ­a con la jerarquÃ­a.
        - **Impacto:** JerarquÃ­a visual clara y consistente con el resto de la aplicaciÃ³n.
    
    3. **Algoritmo de preservaciÃ³n de ancestros (path-preserving):**
        - Se implementÃ³ lÃ³gica para incluir automÃ¡ticamente los padres de activos que coinciden con la bÃºsqueda.
        - Se evita que los activos aparezcan como "huÃ©rfanos" en la raÃ­z cuando se aplican filtros.
        - **Impacto:** Mantiene el contexto jerÃ¡rquico completo, facilitando la navegaciÃ³n.
    
    4. **Mejora de UX - Apertura del modal:**
        - Se agregÃ³ `onClick` al `TextField` del campo de activos en `CustomSelect2.tsx`.
        - El modal ahora se abre al hacer clic en cualquier parte del campo, no solo en el icono de bÃºsqueda.
        - **Impacto:** Experiencia de usuario mÃ¡s intuitiva y acceso directo al Ã¡rbol jerÃ¡rquico.

- **Funcionalidad final:**
    - Filtrado automÃ¡tico por la ubicaciÃ³n seleccionada en el formulario.
    - PresentaciÃ³n en forma de Ã¡rbol expandible/colapsable.
    - DiseÃ±o consistente con `LocationDetails.tsx`.
    - BÃºsqueda local dentro del modal que preserva la jerarquÃ­a.
    - Ordenamiento alfabÃ©tico automÃ¡tico.


## 11. SoluciÃ³n al Error de CreaciÃ³n de Usuarios "Index: 0, Size: 0"
- **Problema**: Al crear un usuario como administrador, el sistema fallaba con `IndexOutOfBoundsException` porque intentaba acceder a una invitaciÃ³n inexistente (`userInvitations.get(0)`).
- **SoluciÃ³n**:
    - **Backend**: 
        - Se creÃ³ un nuevo mÃ©todo `createMember` en `UserService` que omite la lÃ³gica de invitaciones.
        - Se expuso un endpoint seguro `/users/create` en `UserController` exclusivo para administradores.
    - **Frontend**:
        - Se creÃ³ la acciÃ³n `createUserMember` en Redux (`user.ts`).
        - Se modificÃ³ `CreateUser.tsx` para usar esta acciÃ³n directa.
        - Se adaptÃ³ `RegisterJWT.tsx` para aceptar un manejador `onSubmit` personalizado.
- **Impacto**: Los administradores ahora pueden crear usuarios directamente sin errores, manteniendo la integridad de los datos y la seguridad (verificaciÃ³n de permisos y lÃ­mites de suscripciÃ³n).

## 12. Funcionalidades de GestiÃ³n de Usuarios (DesactivaciÃ³n y EdiciÃ³n de Email)
- **Problema**: Necesidad de desactivar usuarios temporalmente y corregir emails manualmente, manteniendo consistencia visual.
- **SoluciÃ³n**:
    - **Backend**: Implementada lÃ³gica de deactivatedUntil y validaciÃ³n de unicidad de email.
    - **Frontend**: Integrado DeactivateUserDialog con selector de fecha, switch de filtrado exclusivo y ediciÃ³n de email en el modal.
- **Impacto**: Mayor flexibilidad operativa para administradores y recuperaciÃ³n de funcionalidades legacy.

## 13. CorrecciÃ³n CrÃ­tica: Login Fallido
- **Problema**: Imposibilidad de ingreso con usuarios existentes.
- **Causa RaÃ­z**: El archivo de migraciÃ³n Liquibase 2025_12_18_1766060000_add_deactivatedUntil_to_ownUser.xml fue creado pero no se registrÃ³ en db/master.xml.
- **SoluciÃ³n**: Se aÃ±adiÃ³ la etiqueta <include> faltante en master.xml para asegurar la creaciÃ³n de la columna deactivated_until.

## 14. ReactivaciÃ³n y EliminaciÃ³n de Usuarios
- **Archivos modificados:**
    - `UserService.java`: CorrecciÃ³n en `enableUser` para restaurar emails de usuarios con soft-delete.
    - `People.tsx`: RefactorizaciÃ³n de la lÃ³gica de acciones para mostrar el botÃ³n "Habilitar" correctamente en usuarios inactivos y permitir la eliminaciÃ³n lÃ³gica.
- **LÃ³gica:**
    - Al habilitar a un usuario que posee un email modificado (ej: `usuario@email.com _ ID`), el sistema ahora elimina el sufijo automÃ¡ticamente, permitiendo que el usuario pueda volver a iniciar sesiÃ³n.
    - La columna de acciones es ahora mÃ¡s dinÃ¡mica, separando las acciones permitidas segÃºn el estado del usuario (activo/inactivo) y su relaciÃ³n con la compaÃ±Ã­a (propietario).
- **Impacto:** RecuperaciÃ³n total de usuarios "eliminados" accidentalmente y flujo de gestiÃ³n de estados mÃ¡s coherente.

## 15. LocalizaciÃ³n Integral al EspaÃ±ol (i18n)
- **Archivos modificados:**
    - `es.ts` / `en.ts`: AdiciÃ³n de mÃ¡s de 20 claves de traducciÃ³n faltantes.
    - `RegisterJWT.tsx`, `InviteUserDialog.tsx`, `DeactivateUserDialog.tsx`: Reemplazo de cadenas en inglÃ©s hardcodeadas por funciones `t()`.
- **Mejoras:**
    - TraducciÃ³n completa del flujo de desactivaciÃ³n (permanente vs temporal).
    - Mensajes de error de validaciÃ³n de email ahora en espaÃ±ol.
    - UnificaciÃ³n de claves de roles (ej: `VIEW_ONLY_name`) para evitar inconsistencias visuales.
- **Impacto:** AplicaciÃ³n profesional 100% traducida al espaÃ±ol, mejorando la adopciÃ³n por parte de usuarios hispanohablantes.
## 16. Refinamiento de BÃºsqueda y OrdenaciÃ³n (MÃ³vil)
- **Problema**: Las bÃºsquedas locales en los modales de selecciÃ³n eran sensibles a acentos y mayÃºsculas. AdemÃ¡s, las localizaciones y otros elementos no se mostraban ordenados alfabÃ©ticamente por defecto.
- **SoluciÃ³n**:
    - **Utilidad de NormalizaciÃ³n**: Se creÃ³ [strings.ts](file:///c:/lusardi1943/Antigravity/cmms-22-12-2025-V1.0.33/mobile/utils/strings.ts) para eliminar acentos y diacrÃ­ticos, permitiendo bÃºsquedas como "estacion" para encontrar "EstaciÃ³n".
    - **OrdenaciÃ³n A-Z**: Se forzÃ³ la ordenaciÃ³n alfabÃ©tica ascendente en la pantalla de Localizaciones y en todos los modales de selecciÃ³n (Usuarios, Repuestos, Activos, Clientes, Vendedores, etc.).
    - **Mejora de UI**: Se aÃ±adieron barras de bÃºsqueda en modales que carecÃ­an de ellas (Vendedores, Clientes, CategorÃ­as, Medidores, Equipos) para una experiencia consistente.
    - **CorrecciÃ³n de Modelo**: Se aÃ±adiÃ³ `sortField` a `SearchCriteria` en el modelo de pÃ¡gina del mÃ³vil para alinearlo con las capacidades del backend.
- **Impacto**: Una navegaciÃ³n mucho mÃ¡s fluida y profesional en la aplicaciÃ³n mÃ³vil, con datos siempre organizados y una bÃºsqueda extremadamente flexible.

## 17. BÃºsqueda de Activos por UbicaciÃ³n (MÃ³vil)
- **Problema**: Los usuarios necesitaban encontrar activos buscando por el nombre de su ubicaciÃ³n, especialmente en los selectores de activos (modales).
- **SoluciÃ³n**:
    - **Backend**: Se aÃ±adiÃ³ `locationName` a `AssetMiniDTO` y se actualizÃ³ `AssetMapper` para poblar este campo automÃ¡ticamente desde la entidad `Location`.
    - **Frontend (Mobile)**: 
        - Se actualizÃ³ el modelo `AssetMiniDTO` para incluir `locationName`.
        - Se modificÃ³ `SelectAssetsModal.tsx` para que el filtro de bÃºsqueda incluya tanto el nombre del activo como el nombre de su ubicaciÃ³n.
        - Se mejorÃ³ la interfaz del modal para mostrar el nombre de la ubicaciÃ³n debajo del nombre del activo, facilitando su identificaciÃ³n.
- **Impacto**: Mayor eficiencia para el personal de campo, permitiendo localizar activos rÃ¡pidamente basÃ¡ndose en su ubicaciÃ³n fÃ­sica sin necesidad de conocer el nombre exacto del activo.

## 18. EliminaciÃ³n de CachÃ© de BÃºsqueda (MÃ³vil)
- **Problema**: Al realizar una nueva bÃºsqueda o cambiar un filtro, la aplicaciÃ³n mostraba los resultados anteriores hasta que llegaban los nuevos, creando confusiÃ³n y dando la sensaciÃ³n de que la bÃºsqueda no se actualizaba.
- **SoluciÃ³n**:
    - Se implementaron reducers de limpieza (`clearAssets`, `clearWorkOrders`, etc.) en los slices principales de Redux.
    - Se actualizaron los thunks de bÃºsqueda para invocar esta limpieza automÃ¡ticamente al iniciar una nueva peticiÃ³n (pÃ¡gina 0).
    - **Refinamiento (NavegaciÃ³n)**: Se aÃ±adieron `useEffect` en las pantallas de Activos y Ubicaciones para invocar la limpieza al entrar (`onMount`).
    - **Refinamiento (Limpieza de Query)**: Se modificÃ³ `onQueryChange` para que, si el usuario vacÃ­a la caja de bÃºsqueda, se limpie la cachÃ© inmediatamente y se regrese a la vista de jerarquÃ­a.
    - Se resolviÃ³ un conflicto de nombres entre thunks y acciones exportando estas Ãºltimas bajo los namespaces `assetActions` y `locationActions`.
    - **CorrecciÃ³n Backend (Permisos)**: Se corrigiÃ³ un error en `LocationController.java` donde se verificaba el permiso de activos en lugar de localizaciones para la bÃºsqueda.
    - **CorrecciÃ³n Backend (BÃºsqueda Robusta)**: Se ajustÃ³ `WrapperSpecification.java` para aplicar `unaccent` y `lower` solo a campos de texto, evitando errores en campos numÃ©ricos (como ID de empresa) que provocaban resultados vacÃ­os.
    - **CorrecciÃ³n Frontend (SincronizaciÃ³n)**: Se aÃ±adieron dependencias de `view` en los `useEffect` de bÃºsqueda y se implementaron actualizaciones funcionales de estado (`prevCriteria`) para evitar cierres obsoletos (stale closures) durante el debounce.
- **Impacto**: Mejora significativa en la percepciÃ³n de velocidad y precisiÃ³n del sistema. El usuario ahora ve siempre un estado "fresco" al entrar en una secciÃ³n o al borrar sus tÃ©rminos de bÃºsqueda, eliminando la confusiÃ³n por resultados antiguos y asegurando que las bÃºsquedas siempre se ejecuten correctamente.
## 19. Refinamiento de LÃ³gica de BÃºsqueda y Visibilidad (Activos/OTs)
- **Problema**: 
    1. En la pantalla principal de Activos mÃ³vil, aunque la bÃºsqueda tÃ©cnica funcionaba, las tarjetas no mostraban el nombre de la ubicaciÃ³n, dificultando la verificaciÃ³n visual por parte del usuario.
    2. ExistÃ­a una inconsistencia entre la bÃºsqueda de Activos y la de Ã“rdenes de Trabajo, donde esta Ãºltima no permitÃ­a buscar por nombre de activo o ubicaciÃ³n.
- **SoluciÃ³n**:
    - **Backend (SoluciÃ³n RaÃ­z)**: Se identificÃ³ que `AssetMapper` no incluÃ­a `LocationMapper.class` en sus dependencias, lo que resultaba en que el objeto `location` fuera `null` en los resultados de bÃºsqueda de la pantalla principal. Se aÃ±adiÃ³ la dependencia al mapper.
    - **Frontend (Mobile)**:
        - Se actualizÃ³ `WorkOrdersScreen.tsx` para incluir `asset.name` y `location.name` en los campos de bÃºsqueda, unificando la experiencia con la pantalla de Activos.
        - Se aÃ±adieron comentarios aclaratorios sobre el impacto de estos campos en la usabilidad para el tÃ©cnico de campo.
- **Impacto**: Experiencia de usuario consistente y robusta. Ahora el tÃ©cnico puede encontrar cualquier Ã“rden de Trabajo simplemente buscando el nombre del equipo o del sitio, y en la pantalla de Activos, tiene confirmaciÃ³n visual inmediata de la ubicaciÃ³n de cada equipo listado.

## 20. OrdenaciÃ³n Predeterminada de Activos por UbicaciÃ³n (A-Z)
- **Problema**: Los tÃ©cnicos prefieren ver los activos agrupados por su ubicaciÃ³n fÃ­sica para planificar mejor sus rutas, en lugar de una lista alfabÃ©tica por nombre de equipo que mezcla diferentes sitios.
- **SoluciÃ³n**:
    - **Frontend (Mobile)**:
        - Se actualizÃ³ `AssetsScreen.tsx` para que el `sortField` predeterminado sea `location.name`.
        - Se modificÃ³ la lÃ³gica de ordenaciÃ³n local en `SelectAssetsModal.tsx` para priorizar `locationName` seguido del nombre del activo.
    - **Frontend (Web)**:
        - Se ajustÃ³ la configuraciÃ³n de `initialCriteria` en la pantalla de Activos para usar `location.name` como campo de ordenaciÃ³n por defecto.
- **Impacto**: Mayor eficiencia operativa. Los tÃ©cnicos ahora ven sus activos organizados por sitio de forma natural, tanto en la lista principal como al seleccionar activos para nuevas Ã“rdenes de Trabajo.
## 21. NavegaciÃ³n Directa de UbicaciÃ³n (Hoja) a Activos
- **Problema**: Al llegar al Ãºltimo nivel de la jerarquÃ­a de ubicaciones, el usuario debÃ­a salir e ir a la secciÃ³n de Activos para buscar los equipos de ese sitio, rompiendo el flujo de navegaciÃ³n.
- **SoluciÃ³n**:
    - **Backend (API)**: Se extendiÃ³ el endpoint `/assets/children/{id}` para aceptar un parÃ¡metro `locationId`. Cuando se solicita la raÃ­z (`id=0`) con una ubicaciÃ³n, el sistema devuelve solo los activos padre de ese sitio especÃ­fico.
    - **Frontend (Mobile)**:
        - Se actualizÃ³ el thunk `getAssetChildren` para soportar el filtrado por ubicaciÃ³n.
        - Se aÃ±adiÃ³ el botÃ³n **"Ver activos"** en la pestaÃ±a de Detalles de ubicaciÃ³n, visible Ãºnicamente para nodos hoja (`!hasChildren`).
        - La pantalla de Activos ahora puede recibir un contexto de ubicaciÃ³n, ajustando su tÃ­tulo dinÃ¡micamente (ej. "Activos - Planta A").
- **Impacto**: NavegaciÃ³n fluida y contextual. El tÃ©cnico puede explorar la infraestructura fÃ­sica y, al encontrar el punto de interÃ©s, saltar directamente a la gestiÃ³n de sus equipos asociados sin perder el contexto.

## 22. Refinamiento de JerarquÃ­a y BÃºsqueda de Activos (MÃ³vil)
- **Problema**: 
    1. Los activos que tenÃ­an un "padre" en una ubicaciÃ³n diferente (ej. padre en un sitio superior o centralizado) no aparecÃ­an como raÃ­ces al filtrar por una ubicaciÃ³n especÃ­fica, lo que causaba que la lista pareciera incompleta.
    2. Al realizar bÃºsquedas dentro de una ubicaciÃ³n especÃ­fica, los resultados incluÃ­an activos de todo el sistema, rompiendo el aislamiento de sitio.
- **SoluciÃ³n**:
    - **Backend (JPQL)**: Se actualizÃ³ `AssetRepository` para identificar "raÃ­ces locales". Un activo se considera raÃ­z para una ubicaciÃ³n si no tiene padre O si su padre pertenece a una ubicaciÃ³n diferente. TambiÃ©n se aÃ±adiÃ³ la exclusiÃ³n explÃ­cita de activos archivados (`archived = false`).
    - **Frontend (Mobile)**:
        - Se actualizÃ³ `AssetsScreen.tsx` para inicializar y preservar el filtro de `location.id` en los criterios de bÃºsqueda global. 
        - **Impacto**: Las bÃºsquedas ahora respetan el contexto de la ubicaciÃ³n actual.
    - **OptimizaciÃ³n de Mappers**: Se introdujo `toMiniDto` sin contexto en `LocationMapper` para permitir que MapStruct asocie correctamente los datos de ubicaciÃ³n en `AssetShowDTO` sin necesidad de propagar `LocationService` por todo el backend, simplificando el cÃ³digo y evitando errores de compilaciÃ³n.
- **Impacto**: VisualizaciÃ³n completa y precisa de la jerarquÃ­a de activos por sitio, asegurando que el personal de campo vea todos los equipos relevantes y que las bÃºsquedas se mantengan dentro de su Ã¡rea de trabajo actual.

## 23. OptimizaciÃ³n Final de JerarquÃ­a y Rendimiento (MÃ³vil)
- **Problema**: 
    1. Lentitud significativa al navegar por la jerarquÃ­a de activos en el mÃ³vil.
    2. Resultados vacÃ­os al intentar ver activos desde una ubicaciÃ³n especÃ­fica debido a una lÃ³gica de filtrado demasiado restrictiva o inconsistente.
- **SoluciÃ³n**:
    - **Backend (API)**:
        - Se optimizÃ³ `AssetController.java` para que, al solicitar la raÃ­z de una ubicaciÃ³n (`id=0`), devuelva todos los activos de una vez (hasta 5000) omitiendo la paginaciÃ³n restrictiva de 10 elementos.
        - Se aÃ±adiÃ³ registro detallado (`@Slf4j`) para monitorear la entrega de resultados desde el servidor.
    - **Backend (Repositorio)**:
        - Se simplificÃ³ la consulta en `AssetRepository.java` para asegurar la entrega de todos los activos sin padre directo que pertenecen al sitio solicitado.
    - **Frontend (Mobile)**:
        - Se optimizÃ³ `AssetsScreen.tsx` eliminando efectos secundarios redundantes y re-renders innecesarios.
        - Se implementÃ³ un indicador de **"Cargando..."** y un mensaje de **"Sin resultados"** para mejorar la retroalimentaciÃ³n al usuario.
        - La app ahora confÃ­a plenamente en el filtrado realizado por el servidor para el primer nivel de la jerarquÃ­a, lo que agiliza drÃ¡sticamente la visualizaciÃ³n.
- **Impacto**: Una experiencia de navegaciÃ³n instantÃ¡nea y fiable. El personal de campo puede encontrar sus equipos en segundos sin esperas ni pantallas vacÃ­as, garantizando que el diseÃ±o jerÃ¡rquico sea funcional y eficiente en condiciones reales de uso.

## 24. Pre-poblamiento de Contexto en Ã“rdenes de Trabajo (MÃ³vil)
- **Problema**: Al crear una nueva Orden de Trabajo desde el mÃ³vil, los campos de "UbicaciÃ³n" y "Activo" aparecÃ­an vacÃ­os aunque el usuario estuviera viendo el detalle de un equipo o sitio especÃ­fico, obligÃ¡ndole a re-seleccionar los datos.
- **SoluciÃ³n**:
    - **DetecciÃ³n de Pantalla Activa**: Se actualizÃ³ el botÃ³n global (+) (`CreateEntitiesSheet.tsx`) para identificar si el usuario estÃ¡ en `AssetDetails`, `LocationDetails` o una lista de `Assets` filtrada, pasando automÃ¡ticamente estos datos al formulario de creaciÃ³n.
    - **DerivaciÃ³n de UbicaciÃ³n**: En `CreateWorkOrderScreen.tsx`, se implementÃ³ lÃ³gica para que, si se selecciona un activo, el sistema auto-complete la ubicaciÃ³n asociada al equipo.
    - **NavegaciÃ³n Contextual**: Se aseguraron las referencias cruzadas en los menÃºs de detalles para mantener la integridad de los datos durante la creaciÃ³n.
- **Impacto**: ReducciÃ³n significativa de clics y errores humanos. El tÃ©cnico puede ahora saltar directamente de la inspecciÃ³n de un equipo a la creaciÃ³n de su orden de mantenimiento con toda la informaciÃ³n relevante ya pre-cargada.

## 25. OrdenaciÃ³n de Activos por Nombre de UbicaciÃ³n (MÃ³vil)
- **Problema**: Los activos se mostraban en un orden inconsistente (a veces por ID o nombre de activo), lo que dificultaba al personal de campo encontrar equipos que estÃ¡n fÃ­sicamente en la misma zona.
- **SoluciÃ³n**:
    - **OrdenaciÃ³n en Frontend**: Se implementÃ³ una lÃ³gica de ordenamiento personalizada en `AssetsScreen.tsx` que fuerza la organizaciÃ³n de la A a la Z basÃ¡ndose en `asset.location.name`.
    - **Criterio Secundario**: En casos donde los activos pertenecen a la misma ubicaciÃ³n, se aplica un orden alfabÃ©tico por el nombre del activo para mantener la coherencia.
    - **Consistencia Global**: El cambio afecta tanto a la navegaciÃ³n por jerarquÃ­as (carpetas) como a los resultados de bÃºsqueda en modo lista.
- **Impacto**: OrganizaciÃ³n optimizada para el trabajo en campo. Los tÃ©cnicos visualizan los equipos agrupados de forma natural por su ubicaciÃ³n fÃ­sica, mejorando la velocidad de operaciÃ³n.

## 26. MigraciÃ³n a Docker Hub (lusardi1943)
- **Problema**: Las imÃ¡genes de Docker estaban vinculadas a un repositorio externo (intelloop), dificultando el control directo sobre el ciclo de vida de los despliegues y versiones personalizadas.
- **SoluciÃ³n**:
    - **Cambio de Repositorio**: Se actualizÃ³ `docker-compose.yml` para apuntar al namespace `lusardi1943` con el tag de versiÃ³n `V6.22.12.25`.
    - **AutomatizaciÃ³n**: Se creÃ³ un script de PowerShell (`scripts/docker_push.ps1`) para automatizar el proceso de `build` y `push` de las imÃ¡genes de Backend y Frontend.
    - **EstandarizaciÃ³n**: Se fijaron las versiones de las imÃ¡genes para asegurar que los despliegues en producciÃ³n sean consistentes y reproducibles.
- **Impacto**: Control total sobre el despliegue del sistema. El proceso de actualizaciÃ³n de servidores ahora es mÃ¡s robusto, permitiendo subir y descargar versiones especÃ­ficas de la plataforma de forma segura y centralizada.

## 27. Generación de Parche de Cambios (Patch Diff)
- **Problema**: Para aplicar los cambios realizados en una instalación limpia o en otro entorno sin usar Git directamente, se requiere un archivo que consolide todas las modificaciones.
- **Solución**:
    - **Consolidación**: Se generó el archivo `atlas_cmms_v1.0.33.patch` que contiene el diferencial de todos los archivos modificados (Frontend, Backend, Móvil y Configuración).
    - **Línea Base**: El parche toma como punto de partida el inicio de la versión 1.0.33 (commit `d0c4bb9`).
    - **Portabilidad**: El archivo permite replicar toda la lógica de negocio, optimizaciones y correcciones con un solo comando.
- **Impacto**: Facilitación del despliegue y mantenimiento. Cualquier desarrollador o administrador puede ahora llevar el sistema a su estado actual de forma rápida y segura, garantizando la integridad de las mejoras implementadas.
