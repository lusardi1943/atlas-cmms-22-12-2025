/**
 * Normaliza el texto eliminando acentos, tildes y convirtiéndolo a minúsculas.
 * Útil para comparaciones de búsqueda insensibles a acentos y mayúsculas.
 * 
 * @param text El texto a normalizar.
 * @returns El texto normalizado.
 */
export const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD') // Descompone caracteres con acentos
        .replace(/[\u0300-\u036f]/g, ''); // Elimina los diacríticos (acentos)
};

/**
 * Verifica si un texto contiene a otro, ignorando acentos y mayúsculas.
 * 
 * @param source El texto original (donde buscar).
 * @param query El texto de búsqueda.
 * @returns true si el source contiene la query.
 */
export const includesNormalized = (source: string, query: string): boolean => {
    return normalizeText(source).includes(normalizeText(query).trim());
};
