import 'dotenv/config';
import prisma from '../server/db.js';

/**
 * One-time: after adding Section.mediaType (default movie),
 * split any heading that still has TV titles into a TV copy.
 */
const sections = await prisma.section.findMany({
  include: { entries: { select: { id: true, mediaType: true } } },
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
});

let created = 0;
let moved = 0;

for (const section of sections) {
  const tvEntryIds = section.entries.filter((e) => e.mediaType === 'tv').map((e) => e.id);
  const movieEntryIds = section.entries.filter((e) => e.mediaType === 'movie').map((e) => e.id);

  // Ensure movie sections stay mediaType movie (default)
  if (section.mediaType !== 'movie' && section.mediaType !== 'tv') {
    await prisma.section.update({
      where: { id: section.id },
      data: { mediaType: 'movie' },
    });
  }

  if (tvEntryIds.length === 0) continue;

  if (movieEntryIds.length === 0 && section.mediaType === 'movie') {
    // Heading only has TV titles — convert in place
    await prisma.section.update({
      where: { id: section.id },
      data: { mediaType: 'tv' },
    });
    console.log(`Converted “${section.name}” → tv (${tvEntryIds.length} titles)`);
    continue;
  }

  // Split: keep movies on original, create TV twin
  const maxTv = await prisma.section.aggregate({
    where: { mediaType: 'tv' },
    _max: { sortOrder: true },
  });
  const tvSection = await prisma.section.create({
    data: {
      name: section.name,
      mediaType: 'tv',
      sortOrder: (maxTv._max.sortOrder ?? -1) + 1,
    },
  });
  created += 1;

  await prisma.entry.updateMany({
    where: { id: { in: tvEntryIds } },
    data: { sectionId: tvSection.id },
  });
  moved += tvEntryIds.length;
  console.log(
    `Split “${section.name}”: kept ${movieEntryIds.length} movies, moved ${tvEntryIds.length} TV → new heading`,
  );
}

console.log(`Done. createdTvHeadings=${created} movedTvTitles=${moved}`);
await prisma.$disconnect();
