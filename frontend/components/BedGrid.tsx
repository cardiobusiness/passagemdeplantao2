import Link from "next/link";
import { Bed } from "@/lib/types";
import { formatVentilatorySupport } from "@/lib/ventilatorySupport";
import styles from "./BedGrid.module.css";

type Props = {
  beds: Bed[];
  hasSectorAccess?: boolean;
};

export function BedGrid({ beds, hasSectorAccess = true }: Props) {
  const sectorGroups = beds.reduce<Array<{ key: string; name: string; beds: Bed[] }>>((groups, bed) => {
    const key = bed.sectorId ? `sector-${bed.sectorId}` : `sector-name-${bed.sector}`;
    const group = groups.find((currentGroup) => currentGroup.key === key);

    if (group) {
      group.beds.push(bed);
      return groups;
    }

    return [
      ...groups,
      {
        key,
        name: bed.sector,
        beds: [bed]
      }
    ];
  }, []);

  if (!hasSectorAccess) {
    return <p className={styles.empty}>Nenhum setor liberado para este usuário.</p>;
  }

  if (sectorGroups.length === 0) {
    return <p className={styles.empty}>Nenhum leito encontrado nos setores liberados.</p>;
  }

  return (
    <div className={styles.groups}>
      {sectorGroups.map((group) => (
        <section key={group.key} className={styles.group}>
          <div className={styles.groupHeader}>
            <h2>{group.name}</h2>
            <span>{group.beds.length} leitos</span>
          </div>

          <div className={styles.grid}>
            {group.beds.map((bed) => {
              const normalizedStatus = String(bed.status ?? "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();
              const stateClass = !bed.occupied
                ? styles.vacant
                : bed.alertCount > 0 || normalizedStatus === "atencao"
                  ? styles.attention
                  : styles.occupied;
              const href = bed.patient ? `/patients/${bed.patient.id}` : `/patients/new?bedId=${bed.id}`;

              return (
                <Link key={bed.id} href={href} className={styles.linkCard}>
                  <article className={`${styles.card} ${stateClass}`}>
                    <div className={styles.head}>
                      <div>
                        <strong>{bed.code}</strong>
                        <span>{bed.sector}</span>
                      </div>
                      {bed.alertCount > 0 ? <div className={styles.alertBadge}>{bed.alertCount}</div> : null}
                    </div>

                    <div className={styles.content}>
                      <span className={styles.status}>{bed.status}</span>
                      {bed.patient ? (
                        <>
                          <strong>{bed.patient.name}</strong>
                          <p>{bed.patient.diagnosis}</p>
                          <p>Suporte: {formatVentilatorySupport(bed.patient.ventilatorySupport)}</p>
                          <div className={styles.metrics}>
                            <span>Hospital {bed.patient.stayMetrics?.hospitalDays ?? "-"}d</span>
                            <span>CTI {bed.patient.stayMetrics?.ctiDays ?? "-"}d</span>
                            {bed.patient.stayMetrics?.mechanicalVentilationDays ? (
                              <span>VM {bed.patient.stayMetrics?.mechanicalVentilationDays}d</span>
                            ) : null}
                          </div>
                          {bed.patient.filterStatus.status !== "nao_aplicavel" ? (
                            <div
                              className={`${styles.filterBadge} ${
                                bed.patient.filterStatus.isOverdue
                                  ? styles.filterOverdue
                                  : bed.patient.filterStatus.isPreventive
                                    ? styles.filterPreventive
                                    : styles.filterOk
                              }`}
                            >
                              {bed.patient.filterStatus.label}
                            </div>
                          ) : null}
                          <span className={styles.cta}>Abrir ficha clinica</span>
                        </>
                      ) : (
                        <>
                          <strong>Leito disponivel</strong>
                          <p>Aguardando nova admissao.</p>
                          <span className={styles.cta}>Cadastrar novo paciente</span>
                        </>
                      )}
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
