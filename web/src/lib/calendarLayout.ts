/**
 * Algoritmo de layout de agenda (mesmo espirito do Google Calendar/Outlook):
 * dado uma lista de eventos de UM dia, calcula posicao (top/left/width/height)
 * de cada um, garantindo que eventos que se sobrepoem no tempo dividam a
 * largura lado a lado em vez de empilhar um sobre o outro. Puro e sincrono -
 * nao faz nenhuma chamada de rede, so reorganiza dados ja carregados.
 */

export interface LayoutInput {
  id: string;
  time: string; // "HH:MM" ou "HH:MM:SS"
  durationMinutes: number;
}

export interface PositionedEvent<T extends LayoutInput> {
  item: T;
  top: number;
  height: number;
  /** 0-100, percentual da largura da coluna do dia */
  left: number;
  /** 0-100, percentual da largura da coluna do dia */
  width: number;
}

interface Interval<T extends LayoutInput> {
  item: T;
  start: number;
  end: number;
}

function parseStartMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * @param items eventos de um unico dia (qualquer ordem)
 * @param pxPerMinute pixels por minuto (HOUR_HEIGHT / 60)
 * @param startHour primeira hora exibida na grade (o "top: 0" da grade)
 * @param minHeightPx altura minima de um card, mesmo pra consultas curtas
 * @param gapPx respiro vertical entre cards empilhados na mesma faixa
 */
export function layoutDayEvents<T extends LayoutInput>(
  items: T[],
  pxPerMinute: number,
  startHour: number,
  minHeightPx: number,
  gapPx: number
): PositionedEvent<T>[] {
  const intervals: Interval<T>[] = items
    .map((item) => {
      const start = parseStartMinutes(item.time);
      const end = start + Math.max(item.durationMinutes, 1);
      return { item, start, end };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // 1) Agrupa em clusters de eventos conectados por sobreposicao (transitiva:
  // se A cruza com B e B cruza com C, todos ficam no mesmo cluster mesmo que
  // A e C nao se cruzem diretamente) - decide quantas colunas o trecho
  // precisa (largura), deixando A e C dividirem a mesma coluna quando da.
  const clusters: Interval<T>[][] = [];
  let current: Interval<T>[] = [];
  let clusterEnd = -Infinity;
  for (const iv of intervals) {
    if (current.length === 0 || iv.start < clusterEnd) {
      current.push(iv);
      clusterEnd = Math.max(clusterEnd, iv.end);
    } else {
      clusters.push(current);
      current = [iv];
      clusterEnd = iv.end;
    }
  }
  if (current.length > 0) clusters.push(current);

  interface Placed<T extends LayoutInput> {
    iv: Interval<T>;
    left: number;
    width: number;
    totalColumns: number;
  }
  const placed: Placed<T>[] = [];

  for (const cluster of clusters) {
    // Atribui colunas gulosamente: cada evento entra na primeira coluna cujo
    // ultimo evento ja terminou antes dele comecar.
    const columnEnds: number[] = [];
    const columnByEvent = new Map<Interval<T>, number>();
    for (const iv of cluster) {
      let placedColumn = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= iv.start) {
          placedColumn = c;
          break;
        }
      }
      if (placedColumn === -1) {
        placedColumn = columnEnds.length;
        columnEnds.push(iv.end);
      } else {
        columnEnds[placedColumn] = iv.end;
      }
      columnByEvent.set(iv, placedColumn);
    }
    const totalColumns = columnEnds.length;
    for (const iv of cluster) {
      const col = columnByEvent.get(iv)!;
      placed.push({ iv, left: (col / totalColumns) * 100, width: (1 / totalColumns) * 100, totalColumns });
    }
  }

  // 2) Altura minima SO se aplica com seguranca a eventos que ocupam a
  // largura inteira (totalColumns === 1, ou seja, sem conflito real com
  // ninguem) - pra esses, cresce ate minHeightPx mas NUNCA alem do proximo
  // evento largura-inteira do dia, considerando o DIA TODO e nao so o
  // cluster (dois eventos que nao se sobrepoem de verdade mas estao proximos
  // no tempo - ex: termina 10:05, o proximo comeca 10:08 - ainda dividem a
  // mesma faixa visual, mesmo pertencendo a "clusters" diferentes).
  // Eventos que fazem parte de um conflito real (totalColumns > 1) usam
  // altura verdadeira (proporcional ao tempo) sem inflar - a legibilidade
  // deles ja vem da divisao de largura; inflar a altura tambem so apertaria
  // mais o layout sem necessidade.
  const fullWidth = placed.filter((p) => p.totalColumns === 1).sort((a, b) => a.iv.start - b.iv.start);

  const result: PositionedEvent<T>[] = [];
  for (const p of placed) {
    const trueTop = (p.iv.start - startHour * 60) * pxPerMinute;
    const trueHeight = (p.iv.end - p.iv.start) * pxPerMinute;

    let height = trueHeight;
    if (p.totalColumns === 1) {
      const idx = fullWidth.indexOf(p);
      const next = fullWidth[idx + 1];
      const maxAllowedHeight = next ? (next.iv.start - p.iv.start) * pxPerMinute - gapPx : Infinity;
      height = Math.max(trueHeight, Math.min(minHeightPx, maxAllowedHeight));
    }

    result.push({ item: p.iv.item, top: trueTop, height, left: p.left, width: p.width });
  }

  return result;
}
