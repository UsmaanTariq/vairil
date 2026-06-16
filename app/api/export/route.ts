import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
  LevelFormat,
  NumberFormat,
} from 'docx';
import { supabase } from '@/lib/db';

interface IdeaRow {
  title: string;
  trend_ref: string;
  hook: string;
  script: string;
  shot_list: string[];
  audio: string | null;
  caption: string;
  hashtags: string[];
  why: string;
  status: string;
}

function labelParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 18,
        color: '6B7280',
        font: 'Calibri',
      }),
    ],
    spacing: { before: 240, after: 60 },
  });
}

function bodyParagraph(text: string, italic = false): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 22,
        italics: italic,
        font: 'Calibri',
        color: '1F2937',
      }),
    ],
    spacing: { after: 120 },
  });
}

function hookParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 24,
        bold: true,
        font: 'Calibri',
        color: 'FFFFFF',
      }),
    ],
    shading: {
      type: ShadingType.SOLID,
      color: '18181B',
    },
    spacing: { before: 60, after: 180 },
    indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
  });
}

function dividerParagraph(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: 'E5E7EB',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    spacing: { before: 360, after: 360 },
  });
}

function ideaSection(idea: IdeaRow, index: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Idea number + title
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${index + 1}. ${idea.title}`,
          bold: true,
          size: 28,
          font: 'Calibri',
          color: '111827',
        }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 480, after: 120 },
    })
  );

  // Trend badge
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Trend: ${idea.trend_ref}`,
          size: 20,
          italics: true,
          font: 'Calibri',
          color: '6B7280',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // Hook
  paragraphs.push(labelParagraph('Hook — First 3 Seconds'));
  paragraphs.push(hookParagraph(idea.hook));

  // Script
  paragraphs.push(labelParagraph('Script / Voiceover'));
  paragraphs.push(bodyParagraph(idea.script));

  // Shot list
  paragraphs.push(labelParagraph('Shot List'));
  idea.shot_list.forEach((shot, i) => {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${String(i + 1).padStart(2, '0')}  ${shot}`,
            size: 22,
            font: 'Calibri',
            color: '374151',
          }),
        ],
        spacing: { after: 80 },
        indent: { left: convertInchesToTwip(0.25) },
      })
    );
  });

  // Audio
  if (idea.audio) {
    paragraphs.push(labelParagraph('Audio / Sound'));
    paragraphs.push(bodyParagraph(idea.audio));
  }

  // Caption
  paragraphs.push(labelParagraph('Caption'));
  paragraphs.push(bodyParagraph(idea.caption));

  // Hashtags
  if (idea.hashtags?.length > 0) {
    const tags = idea.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join('  ');
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: tags,
            size: 20,
            color: '3B82F6',
            font: 'Calibri',
          }),
        ],
        spacing: { after: 180 },
      })
    );
  }

  // Why it works
  paragraphs.push(labelParagraph('Why This Works'));
  paragraphs.push(bodyParagraph(idea.why, true));

  return paragraphs;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id } = body as { project_id: string };

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    // Load project
    const { data: project } = await supabase
      .from('projects')
      .select('client_name, niche, platforms')
      .eq('id', project_id)
      .single();

    // Load synthesis profile
    const { data: synthRow } = await supabase
      .from('synthesis')
      .select('profile')
      .eq('project_id', project_id)
      .single();

    const profile = synthRow?.profile as Record<string, string> | null;

    // Load ideas — approved first, fall back to all if none approved
    const { data: allIdeas } = await supabase
      .from('ideas')
      .select('title, trend_ref, hook, script, shot_list, audio, caption, hashtags, why, status')
      .eq('project_id', project_id);

    const approved = (allIdeas ?? []).filter((r) => r.status === 'approved');
    const ideas: IdeaRow[] = (approved.length > 0 ? approved : allIdeas ?? []) as IdeaRow[];

    if (ideas.length === 0) {
      return NextResponse.json({ error: 'No ideas to export' }, { status: 400 });
    }

    const clientName = project?.client_name ?? 'Client';
    const niche = project?.niche ?? '';
    const platforms: string[] = (project?.platforms ?? []) as string[];
    const exportDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Build document
    const coverParagraphs: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: 'TrendForge',
            bold: true,
            size: 20,
            font: 'Calibri',
            color: '6B7280',
          }),
        ],
        spacing: { before: 0, after: 480 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: clientName,
            bold: true,
            size: 56,
            font: 'Calibri',
            color: '111827',
          }),
        ],
        spacing: { after: 160 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Content Plan',
            size: 36,
            font: 'Calibri',
            color: '4B5563',
          }),
        ],
        spacing: { after: 480 },
      }),
    ];

    if (niche) {
      coverParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Niche: ', bold: true, size: 22, font: 'Calibri', color: '374151' }),
            new TextRun({ text: niche, size: 22, font: 'Calibri', color: '374151' }),
          ],
          spacing: { after: 80 },
        })
      );
    }

    if (platforms.length > 0) {
      coverParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Platforms: ', bold: true, size: 22, font: 'Calibri', color: '374151' }),
            new TextRun({ text: platforms.join(', '), size: 22, font: 'Calibri', color: '374151' }),
          ],
          spacing: { after: 80 },
        })
      );
    }

    coverParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Date: ', bold: true, size: 22, font: 'Calibri', color: '374151' }),
          new TextRun({ text: exportDate, size: 22, font: 'Calibri', color: '374151' }),
        ],
        spacing: { after: 80 },
      })
    );

    coverParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: approved.length > 0
              ? `${ideas.length} approved idea${ideas.length !== 1 ? 's' : ''}`
              : `${ideas.length} idea${ideas.length !== 1 ? 's' : ''}`,
            size: 20,
            italics: true,
            font: 'Calibri',
            color: '9CA3AF',
          }),
        ],
        spacing: { before: 240, after: 0 },
      })
    );

    // Profile section
    const profileParagraphs: Paragraph[] = [];
    if (profile) {
      profileParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Business Profile',
              bold: true,
              size: 36,
              font: 'Calibri',
              color: '111827',
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 720, after: 240 },
        })
      );

      const profileFields: [string, string][] = [
        ['Description', profile.description],
        ['Audience', profile.audience],
        ['Positioning', profile.positioning],
        ['Offers', profile.offers],
        ['Tone', profile.tone],
        ['Content Goals', profile.contentGoals],
        ['Filming Constraints', profile.filmingConstraints],
      ];

      for (const [label, value] of profileFields) {
        if (value && value !== 'unknown') {
          profileParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${label}: `, bold: true, size: 22, font: 'Calibri', color: '374151' }),
                new TextRun({ text: value, size: 22, font: 'Calibri', color: '4B5563' }),
              ],
              spacing: { after: 120 },
            })
          );
        }
      }
    }

    // Ideas section
    const ideasHeading = new Paragraph({
      children: [
        new TextRun({
          text: 'Content Ideas',
          bold: true,
          size: 36,
          font: 'Calibri',
          color: '111827',
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 720, after: 120 },
    });

    const ideasParagraphs: Paragraph[] = [ideasHeading];
    ideas.forEach((idea, i) => {
      ideasParagraphs.push(...ideaSection(idea, i));
      if (i < ideas.length - 1) {
        ideasParagraphs.push(dividerParagraph());
      }
    });

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'shot-list',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) } },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          children: [
            ...coverParagraphs,
            ...profileParagraphs,
            ...ideasParagraphs,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    const safeClientName = clientName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `trendforge-${safeClientName}-${dateSlug}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
