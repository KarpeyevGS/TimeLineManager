interface Parameter {
  id: number;
  name: string;
  parentId: number | null;
  level: number;
  children?: Parameter[];
}

/**
 * Получить все видимые параметры на основе expanded состояния
 * Если родитель свернут, его дочерние параметры не видны
 */
export const getVisibleParameters = (
  parameters: Parameter[],
  expandedParams: Set<number>
): Parameter[] => {
  const result: Parameter[] = [];

  const traverse = (params: Parameter[]) => {
    params.forEach((param) => {
      result.push(param);
      // Показываем дочерних только если родитель развернут
      if (param.children && expandedParams.has(param.id)) {
        traverse(param.children);
      }
    });
  };

  traverse(parameters);
  return result;
};

/**
 * Получить параметры которые закреплены сверху
 */
export const getFrozenParameters = (
  visibleParameters: Parameter[],
  frozenParams: Set<number>
): Parameter[] => {
  return visibleParameters.filter((p) => frozenParams.has(p.id));
};

/**
 * Получить параметры которые прокручиваются (не закреплены)
 */
export const getScrollableParameters = (
  visibleParameters: Parameter[],
  frozenParams: Set<number>
): Parameter[] => {
  return visibleParameters.filter((p) => !frozenParams.has(p.id));
};

/**
 * Проверить есть ли у параметра дочерние элементы
 */
export const hasChildren = (parameter: Parameter): boolean => {
  return parameter.children !== undefined && parameter.children.length > 0;
};

/**
 * Рекурсивно найти параметр по ID
 */
export const findParameterById = (
  parameters: Parameter[],
  id: number
): Parameter | null => {
  for (const param of parameters) {
    if (param.id === id) {
      return param;
    }
    if (param.children) {
      const found = findParameterById(param.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

/**
 * Получить всех потомков параметра (не только прямых дочерних)
 */
export const getAllChildren = (parameter: Parameter): Parameter[] => {
  const result: Parameter[] = [];

  const traverse = (params: Parameter[]) => {
    params.forEach((p) => {
      result.push(p);
      if (p.children) {
        traverse(p.children);
      }
    });
  };

  if (parameter.children) {
    traverse(parameter.children);
  }

  return result;
};
