"use client";
import { useEffect, useState } from "react";
import fetchCompletedComics from "../utils/fetchCompletedComics";
import fetchComicPanel from "../utils/fetchComicPanel";
import { FilterBar } from "./FilterBar";

import {
  Button,
  ButtonGroup,
  Typography,
  Grid2 as Grid,
  Box,
  Link,
} from "@mui/material";

export default function Community() {
  const [comics, setComics] = useState([]);

  const [sortedComics, setSortedComics] = useState([]);
  const [filteredComics, setFilteredComics] = useState([]);
  const [filters, setFilters] = useState({
    sortBy: "completedAt",
    showMyComics: false,
    comicType: "all",
  });

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  useEffect(() => {
    async function fetchData() {
      const data = await fetchCompletedComics();

      for (const comic of data) {
        const firstPanelImage = await fetchComicPanel(comic.panels[0]);
        comic.firstPanelImage = firstPanelImage;
      }

      setComics(data);
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (comics.length > 0) {
      const sortedComics = [...comics].sort((comicA, comicB) => {
        switch (filters.sortBy) {
          case "likes":
            return (comicB.comicLikes || 0) - (comicA.comicLikes || 0);
          case "theme":
            return (comicA.comicTheme || "").localeCompare(
              comicB.comicTheme || ""
            );
          case "completedAt":
          default:
            return (
              comicB.createdAt.toDate().getTime() -
              comicA.createdAt.toDate().getTime()
            );
        }
      });

      setSortedComics(sortedComics);
    }
  }, [comics, filters.sortBy]);

  useEffect(() => {
    if (sortedComics.length > 0) {
      const filtered = sortedComics.filter((comic) => {
        switch (filters.comicType) {
          case "solo":
            return comic.isSolo === true; //show solo comics
          case "team":
            return comic.isSolo === false; //show team comics
          case "all":
          default:
            return true; //show all comics
        }
      });
      setFilteredComics(filtered);
    }
  }, [sortedComics, filters.comicType]);

  return (
    <>
      {/* <ButtonGroup sx={{ mb: 2, gap: 0.5, justifyContent: "center" }}>
        <Button href={"/"} size="large" variant="contained">
          Home
        </Button>

        <Button href={"/create"} size="large" variant="contained">
          Create
        </Button>
      </ButtonGroup> */}
      <Typography variant="h3" sx={{ textAlign: "center" }}>
        Community
      </Typography>
      <Typography variant="body1" sx={{ textAlign: "center" }}>
        See what other users have created!
      </Typography>
      <FilterBar onFilterChange={handleFilterChange} filters={filters} />

      <Grid container spacing={3} sx={{ justifyContent: "center" }}>
        {filteredComics.map((comic) => (
          <Grid key={comic.id}>
            <Link href={"/comic/" + comic.id} underline="none">
              <Box
                component="img"
                src={comic.firstPanelImage}
                alt={comic.comicTheme}
                sx={{
                  height: "250px",
                  bgcolor: "white",
                }}
              />

              <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                {comic.comicTheme}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Created: {comic.createdAt.toDate().toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Likes: {comic.comicLikes}
              </Typography>
            </Link>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
