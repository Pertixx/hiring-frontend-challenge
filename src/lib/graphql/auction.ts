import { gqlRequest, type GraphQLResult } from "@/lib/graphql/client";
import type { Auction, AuctionState, Bid } from "@/lib/auction/types";
import { sortBidsDesc } from "@/lib/auction/types";

export const AUCTION_QUERY = /* GraphQL */ `
  query AuctionBySlug($slug: String!) {
    auction(slug: $slug) {
      id
      slug
      title
      auctionType
      make
      model
      version
      year
      location
      country
      odometer
      fuelType
      transmissionType
      origin
      color
      state
      startsAt
      endsAt
      viewCount
      isNoReserve
      hasMetReserve
      isNearingReserve
      countBids
      countWatchers
      currency {
        name
        symbol
      }
      currentBid {
        ...BidFields
      }
      bids {
        ...BidFields
      }
      result {
        finishedAt
        winningBid {
          amount
        }
      }
      parts {
        __typename
        ... on MainImage {
          imageUri
        }
        ... on ImageGallery {
          imageUris
        }
        ... on Description {
          text
        }
      }
    }
  }

  fragment BidFields on AuctionBid {
    id
    amount
    date
    isAuto
    profile {
      id
      username
      isVerified
      avatar
    }
  }
`;

/* ---- Forma cruda de la respuesta (sólo lo que pedimos en la query) ---- */

interface RawBid {
  id: string;
  amount: number;
  date: string;
  isAuto: boolean | null;
  profile: {
    id: string;
    username: string;
    isVerified: boolean;
    avatar: string | null;
  } | null;
}

type RawPart =
  | { __typename: "MainImage"; imageUri: string }
  | { __typename: "ImageGallery"; imageUris: string[] }
  | { __typename: "Description"; text: string }
  | { __typename: "Attributes" }
  | { __typename: "EmbedGallery" };

interface RawAuction {
  id: string;
  slug: string;
  title: string;
  auctionType: string;
  make: string;
  model: string;
  version: string | null;
  year: number;
  location: string;
  country: string;
  odometer: number;
  fuelType: string;
  transmissionType: string;
  origin: string;
  color: string;
  state: AuctionState;
  startsAt: string | null;
  endsAt: string | null;
  viewCount: number;
  isNoReserve: boolean;
  hasMetReserve: boolean;
  isNearingReserve: boolean;
  countBids: number;
  countWatchers: number;
  currency: { name: string; symbol: string };
  currentBid: RawBid | null;
  bids: RawBid[];
  result: {
    finishedAt: string;
    winningBid: { amount: number } | null;
  } | null;
  parts: RawPart[];
}

interface AuctionQueryData {
  auction: RawAuction | null;
}

function toBid(raw: RawBid): Bid {
  return {
    id: raw.id,
    amount: raw.amount,
    date: raw.date,
    isAuto: raw.isAuto ?? false,
    profile: raw.profile
      ? {
          id: raw.profile.id,
          username: raw.profile.username,
          isVerified: raw.profile.isVerified,
          avatar: raw.profile.avatar,
        }
      : null,
  };
}

function toAuction(raw: RawAuction): Auction {
  let mainImage: string | null = null;
  const gallery: string[] = [];
  const description: string[] = [];

  for (const part of raw.parts) {
    switch (part.__typename) {
      case "MainImage":
        mainImage ??= part.imageUri;
        break;
      case "ImageGallery":
        gallery.push(...part.imageUris);
        break;
      case "Description":
        description.push(part.text);
        break;
      default:
        // Attributes / EmbedGallery: no se muestran en esta vista.
        break;
    }
  }

  const { parts: _parts, ...rest } = raw;
  void _parts;

  return {
    ...rest,
    currentBid: raw.currentBid ? toBid(raw.currentBid) : null,
    bids: sortBidsDesc(raw.bids.map(toBid)),
    mainImage,
    gallery,
    description,
  };
}

export interface AuctionSnapshot {
  auction: Auction | null;
  serverTime: number | null;
}

/**
 * Trae la subasta por slug. `auction` es `null` si no existe.
 * Lanza `GraphQLRequestError` si la API no responde o devuelve error.
 */
export async function fetchAuction(
  slug: string,
  init?: { signal?: AbortSignal },
): Promise<AuctionSnapshot> {
  const result: GraphQLResult<AuctionQueryData> = await gqlRequest(
    AUCTION_QUERY,
    { slug },
    init,
  );
  return {
    auction: result.data.auction ? toAuction(result.data.auction) : null,
    serverTime: result.serverTime,
  };
}
