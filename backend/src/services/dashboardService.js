import { prisma } from "../middleware/prismaMiddleware.js";
import { activeBedWhere, activePatientWhere } from "./sectorAccessService.js";

const originLabels = {
  emergencia: "Emergencia",
  transferencia_externa: "Transferencia externa",
  centro_cirurgico: "Centro Cirurgico",
  transferencia_interna: "Transferencia interna",
  nao_informado: "Nao informado"
};

export async function getMonthlyDashboard(organizationId, sectorIds) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const bedWhere = activeBedWhere(organizationId, sectorIds);
  const patientWhere = activePatientWhere(organizationId, sectorIds);

  const [totalBeds, occupiedBeds, totalPatients, admissionsThisMonth, activeAlerts, patientOrigins] = await Promise.all([
    prisma.bed.count({
      where: bedWhere
    }),
    prisma.bed.count({
      where: {
        ...bedWhere,
        occupied: true,
      }
    }),
    prisma.patient.count({ where: patientWhere }),
    prisma.patient.count({
      where: {
        ...patientWhere,
        admissionDate: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth
        }
      }
    }),
    prisma.alert.count({
      where: {
        isActive: true,
        patient: patientWhere
      }
    }),
    prisma.patient.findMany({
      where: patientWhere,
      select: {
        age: true,
        origin: true
      }
    })
  ]);

  const respiratoryEvolutions = await prisma.evolution.count({
    where: {
      patient: patientWhere,
      type: "respiratoria",
      date: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth
      }
    }
  });

  const motorEvolutions = await prisma.evolution.count({
    where: {
      patient: patientWhere,
      type: "motora",
      date: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth
      }
    }
  });

  const labs = await prisma.lab.count({
    where: {
      patient: patientWhere,
      date: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth
      }
    }
  });

  const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
  const avgLengthOfStay =
    totalPatients > 0
      ? Math.round(
          (await prisma.admissionMetrics.aggregate({
            where: {
              patient: patientWhere
            },
            _avg: { daysInICU: true }
          }))._avg.daysInICU || 0
        )
      : 0;

  const originBuckets = patientOrigins.reduce((accumulator, patient) => {
    const origin = patient.origin ?? "nao_informado";
    const current = accumulator.get(origin) ?? { total: 0, ageSum: 0 };
    current.total += 1;
    current.ageSum += patient.age ?? 0;
    accumulator.set(origin, current);
    return accumulator;
  }, new Map());

  const orderedOrigins = [
    "emergencia",
    "transferencia_externa",
    "centro_cirurgico",
    "transferencia_interna",
    "nao_informado"
  ];

  const originStats = orderedOrigins.map((origin) => {
    const bucket = originBuckets.get(origin) ?? { total: 0, ageSum: 0 };
    return {
      origin,
      label: originLabels[origin],
      total: bucket.total,
      percentage: totalPatients > 0 ? Math.round((bucket.total / totalPatients) * 100) : 0
    };
  });

  const averageAdmissionAge =
    totalPatients > 0
      ? Math.round(patientOrigins.reduce((sum, patient) => sum + (patient.age ?? 0), 0) / totalPatients)
      : 0;

  const averageAgeByOrigin = orderedOrigins.map((origin) => {
    const bucket = originBuckets.get(origin) ?? { total: 0, ageSum: 0 };
    return {
      origin,
      label: originLabels[origin],
      averageAge: bucket.total > 0 ? Math.round(bucket.ageSum / bucket.total) : 0
    };
  });

  return {
    month: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    occupancyRate: Math.round(occupancyRate),
    activeAlerts,
    respiratoryEvolutions,
    motorEvolutions,
    averageLengthOfStay: avgLengthOfStay,
    averageAdmissionAge,
    originStats,
    averageAgeByOrigin,
    examsRegistered: labs,
    metrics: {
      totalBeds,
      occupiedBeds,
      totalPatients,
      admissionsThisMonth
    }
  };
}
