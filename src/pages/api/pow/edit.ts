import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/prisma';

interface PoW {
  id?: string;
  userId: string;
  title: string;
  description: string;
  skills: string[];
  subSkills: string[];
  link: string;
  createdAt?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { userId, pows } = req.body as { userId: string; pows: PoW[] };
  const errors: string[] = [];

  if (
    !userId ||
    typeof userId !== 'string' ||
    userId.trim() === '' ||
    userId.includes('*')
  ) {
    return res.status(400).json({ error: 'Invalid or missing "userId".' });
  }

  if (!pows) {
    return res
      .status(400)
      .json({ error: 'The "pows" field is missing in the request body.' });
  }

  const existingPoWs = await prisma.poW.findMany({
    where: { userId },
    select: { id: true },
  });

  const existingIds = existingPoWs.map((pow) => pow.id);
  const incomingIds = pows.map((pow) => pow.id).filter(Boolean) as string[];
  const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));

  const createData: { [key: string]: any }[] = [];
  const updateData: { where: { id: string }; data: { [key: string]: any } }[] =
    [];

  // eslint-disable-next-line no-restricted-syntax
  for (const pow of pows) {
    if (!pow) {
      errors.push('One of the data entries is undefined or null.');
      // eslint-disable-next-line no-continue
      continue;
    }

    const { id, ...otherFields } = pow;

    if (id) {
      updateData.push({
        where: { id },
        data: { ...otherFields, userId },
      });
    } else {
      createData.push({ ...otherFields, userId });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const transactionActions = [
      prisma.poW.createMany({ data: createData as any }), // Casting to any as a workaround
      ...updateData.map((data) => prisma.poW.update(data)),
      ...idsToDelete.map((id) => prisma.poW.delete({ where: { id } })),
    ];

    const results = await prisma.$transaction(transactionActions);
    return res.status(200).json(results);
  } catch (error: any) {
    if (error.code) {
      return res.status(500).json({
        error: {
          code: error.code,
          message: error.message,
          meta: error.meta,
        },
      });
    }
    return res.status(500).json({ error });
  }
}
