import { Post } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import prisma from "../../prisma/prisma";
import showdown from "showdown";

export default {
  single: (post: Post, isUserSubscriber?: boolean) => ({
    ...post,
    isContentHidden: !(isUserSubscriber || post.isPublic),
  }),
};

const converter = new showdown.Converter({ headerLevelStart: 2 });

export const markdownAsHtml = (content?: string | null) => {
  const text = content ?? "";
  const html = converter.makeHtml(text);
  return html;
};

export const doesPostBelongToUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId, postId } = req.params;

  if (userId && postId) {
    const post = await prisma.post.findFirst({
      where: {
        artist: {
          userId: Number(userId),
        },
        deletedAt: null,
      },
    });
    if (post) {
      return next();
    } else {
      res.status(400).json({
        error: `Post must belong to user`,
      });
      return next(`Post must belong to user`);
    }
  } else {
    res.status(400).json({
      error: `Bad request`,
    });
    return next(`userId and postId are required`);
  }
};
