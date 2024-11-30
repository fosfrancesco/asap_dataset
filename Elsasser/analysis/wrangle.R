# We came, we saw and we wrangled.
library(tidyverse)

#' Get the root of the ASAP project
#' @return normalized path
get_asap_root <- function() {
  getwd() |>
    file.path("../..") |>
    normalizePath()
}

#' Load the metadata manifest. There are two types of data (that we care about)
#' in the ASAP manifest: performance and score. There is a many to one relationship,
#' many performances to a single score. It doesn't make sense to return them as
#' a unit, because they are very different animals. This function is going to
#' do some wrangling and separate them into two separate dataframes and
#' eliminate the redundancy.
#' @param root the root of the ASAP project
#' @return a named list with two dataframes: `performances` and `scores`
load_manifest <- function(root = get_asap_root()) {
  manifest_path <- file.path(root, "metadata.csv")
  # we are adding an ID so that we can join performances and scores to their manifest.
  manifest_tbl <- read_csv(manifest_path) |>
    mutate(id = row_number())
  performance_tbl <- manifest_tbl |>
    select(id, composer, yearBorn, yearDied, title, csv_performance) |>
    rename(path = csv_performance)
  score_tbl <- manifest_tbl |>
    select(id, composer, yearBorn, yearDied, title, csv_score) |>
    rename(path = csv_score) |>
    distinct()
  list(performances = performance_tbl, scores = score_tbl)
}

#' You may try to load the whole manifest or you may try to load a subset of it.
#' At the time of writing this I'm not sure whether the whole dataset will fit.
#' And even if it does, it may be too slow or too much. So we shall let the user
#' decide what to load.
#' @param df all or part of the manifest dataframe
#' @return a list of dataframes. Each carries an `id` column with the corresponding
#'  `df` row.
load_manifest_data <- function(df) {
  map(df, function(row) {
    path = file.path(get_asap_root(), row$path)
    read_csv(path) |>
      mutate(id = row$id)
  })
}
